/**
 * Service for interacting with Bluetooth POS printers using Web Bluetooth API.
 * Supports ESC/POS commands for printing receipts and opening cash drawers.
 */

export class PrinterService {
  private device: any = null;
  private characteristic: any = null;

  // Common UUIDs for Bluetooth POS printers
  private readonly SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
  private readonly CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

  /**
   * Request and connect to a Bluetooth printer.
   */
  async connect(): Promise<string> {
    try {
      if (!(navigator as any).bluetooth) {
        throw new Error('Bluetooth is not supported in this browser.');
      }

      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [this.SERVICE_UUID]
      });

      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(this.SERVICE_UUID);
      const characteristics = await service.getCharacteristics();
      
      // Try to find a writable characteristic
      this.characteristic = characteristics.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);

      if (!this.characteristic) {
        throw new Error('Could not find a writable characteristic on the devicce.');
      }

      return this.device.name || 'Connected Printer';
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect the current printer.
   */
  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  /**
   * Send raw data to the printer.
   */
  private async write(data: Uint8Array) {
    if (!this.characteristic) {
      throw new Error('Not connected to a printer.');
    }

    // Split data into chunks if it's too large for BLE MTU
    const CHUNK_SIZE = 20;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
    }
  }

  /**
   * Initialize the printer.
   */
  async init() {
    await this.write(new Uint8Array([0x1B, 0x40]));
  }

  /**
   * Open the cash drawer.
   */
  async openDrawer() {
    // ESC p m t1 t2
    // Pulse to connector pin 2 or pin 5
    await this.write(new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]));
  }

  /**
   * Print text with optional formatting.
   */
  async printText(text: string, options: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: 'normal' | 'large' } = {}) {
    const commands: number[] = [];

    // Alignment
    const alignMap = { left: 0, center: 1, right: 2 };
    commands.push(0x1B, 0x61, alignMap[options.align || 'left']);

    // Bold
    commands.push(0x1B, 0x45, options.bold ? 1 : 0);

    // Size
    if (options.size === 'large') {
      commands.push(0x1D, 0x21, 0x11); // Double width & height
    } else {
      commands.push(0x1D, 0x21, 0x00); // Normal
    }

    await this.write(new Uint8Array(commands));

    // Convert text to bytes (Simple ASCII mapping)
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text + '\n');
    await this.write(textBytes);
  }

  /**
   * Feed and cut paper.
   */
  async cut() {
    // Feed 3 lines and cut
    await this.write(new Uint8Array([0x1B, 0x64, 0x03, 0x1D, 0x56, 0x00]));
  }

  /**
   * Print a specialized receipt for coffee shop order.
   */
  async printReceipt(
    shopName: string, 
    orderItems: any[], 
    total: number, 
    details?: { 
      tendered?: number; 
      change?: number; 
      paymentMethod?: string; 
      orderNumber?: string;
      customerName?: string;
      cardNumber?: string;
      pointsEarned?: number;
      pointsBalance?: number;
      discount?: number;
    }
  ) {
    try {
      await this.init();
      
      // Header
      await this.printText(shopName || 'CoffeeGarage', { align: 'center', size: 'large', bold: true });
      await this.printText('RECEIPT', { align: 'center', bold: true });
      if (details?.orderNumber) {
        await this.printText(`Order #${details.orderNumber}`, { align: 'center' });
      }
      await this.printText('--------------------------------', { align: 'center' });
      await this.printText(new Date().toLocaleString(), { align: 'left' });
      await this.printText('--------------------------------', { align: 'center' });

      // Items
      for (const item of orderItems) {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        const line = `${item.name.slice(0, 16).padEnd(16)} x${item.quantity}  PHP ${itemTotal.padStart(8)}`;
        await this.printText(line, { align: 'left' });
      }

      // Loyalty discount if applicable
      if (details?.discount && details.discount > 0) {
        await this.printText(`LOYALTY DISCOUNT: -PHP ${details.discount.toFixed(2)}`, { align: 'right' });
      }

      // Footer
      await this.printText('--------------------------------', { align: 'center' });
      await this.printText(`TOTAL: PHP ${total.toFixed(2)}`, { align: 'right', bold: true, size: 'large' });
      
      if (details?.tendered !== undefined && details?.tendered > 0) {
        await this.printText(`CASH TENDERED: PHP ${details.tendered.toFixed(2)}`, { align: 'right' });
        await this.printText(`CHANGE: PHP ${(details.change || 0).toFixed(2)}`, { align: 'right', bold: true });
      }

      if (details?.paymentMethod) {
        await this.printText(`Payment: ${details.paymentMethod.toUpperCase()}`, { align: 'left' });
      }

      // Loyalty Card Details
      if (details?.customerName || details?.cardNumber) {
        await this.printText('--------------------------------', { align: 'center' });
        if (details.customerName) {
          await this.printText(`LOYALTY: ${details.customerName}`, { align: 'left' });
        }
        if (details.cardNumber) {
          await this.printText(`CARD NO: ${details.cardNumber}`, { align: 'left' });
        }
        if (details.pointsEarned) {
          await this.printText(`POINTS EARNED: +${details.pointsEarned}`, { align: 'left' });
        }
        if (details.pointsBalance !== undefined) {
          await this.printText(`CURRENT POINTS: ${details.pointsBalance}`, { align: 'left' });
        }
      }

      await this.printText('--------------------------------', { align: 'center' });
      await this.printText('Thank you for visiting CoffeeGarage!', { align: 'center' });
      await this.printText('Please come again!', { align: 'center' });
      
      await this.cut();
      await this.openDrawer();
    } catch (error) {
      console.error('Printing receipt failed:', error);
      throw error;
    }
  }

  /**
   * Prints a test receipt to verify printer connection and formatting.
   */
  async printTestReceipt(shopName: string) {
    await this.init();
    await this.printText(shopName || 'CoffeeGarage', { align: 'center', size: 'large', bold: true });
    await this.printText('TEST PRINT SUCCESSFUL', { align: 'center', bold: true });
    await this.printText('--------------------------------', { align: 'center' });
    await this.printText(`Printer Connected OK: ${this.device?.name || 'POS Printer'}`, { align: 'center' });
    await this.printText(new Date().toLocaleString(), { align: 'center' });
    await this.printText('--------------------------------', { align: 'center' });
    await this.cut();
  }

  isConnected(): boolean {
    return !!this.characteristic;
  }
}

export const printerService = new PrinterService();
