import TZ1200RLE from './TZ1200RLE';

import { PNGReader } from 'PNGReader.js';

export function readPNG(imageBytes) {
  const reader = new PNGReader(imageBytes);
  return new Promise((resolve, reject) => {
    reader.parse((err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });
}

class ImageConverter {
  static COLOR_TYPE = Object.freeze({
    BW: 0,
    RGB: 2,
    PALETTE: 3,
    BWA: 4,
    RGBA: 6,
  });

  static TEXTURE_FORMAT = Object.freeze({
    A8: 0x00080008,
    BGRA8888: 0x01208888,
    ABGR8888: 0x02208888,
  });

  static TEXTURE_COMPRESSION = Object.freeze({
    RLE: 0x10000000,
  });

  static KORU_CONST = Object.freeze({
    TXI_FILE_TYPE: 0x0A697874,
    TXI_FILE_VERSION: 0x20000028,
    HEADER_LENGTH: 40,
  });

  constructor(image) {
    this.image = image;
    this.rle = new TZ1200RLE();
  }

  _writeArray(arr) {
    for (const byte of arr) {
      this.view.setUint8(this.p, byte);
      this.p += 1;
    }
  }

  _emit(pixel, enc) {
    const packed = this.rleEncode ? this.rle.encode(pixel) : pixel;
    if (packed) this._writeArray(packed);
  }

  get width() {
    return this.image.getWidth();
  }

  get height() {
    return this.image.getHeight();
  }

  get colorType() {
    return this.image.getColorType();
  }

  get bytesPerPixel() {
    return this.isRGB ? 4 : 1;
  }

  get isRGB() {
    return this.colorType === ImageConverter.COLOR_TYPE.RGB
      || this.colorType === ImageConverter.COLOR_TYPE.RGBA
      || this.colorType === ImageConverter.COLOR_TYPE.PALETTE;
  }

  get isGreyscale() {
    return this.colorType === ImageConverter.COLOR_TYPE.BW
      || this.colorType === ImageConverter.COLOR_TYPE.BWA;
  }

  static convertPNGtoTXI(image) {
    const conv = new ImageConverter(image);

    // RLE is seemingly never bigger in any case
    // I've tried, so screw it, let's use it every time.
    // Non-RLE code is left in incase we discover otherwise.
    return conv.convert({ rle: true });
  }

  _writeHeader() {
    
    let formatType;
    if (this.isRGB) {
      // I have no idea why we're using a different byte order
      // for RLE vs not-RLE encoded images...
      if (this.rleEncode) {
        formatType = ImageConverter.TEXTURE_FORMAT.ABGR8888;
      } else {
        formatType = ImageConverter.TEXTURE_FORMAT.BGRA8888;
      }
    } else {
      formatType = ImageConverter.TEXTURE_FORMAT.A8;
    }

    if (this.rleEncode) formatType |= ImageConverter.TEXTURE_COMPRESSION.RLE;

    const imageDataLen = this.p - ImageConverter.KORU_CONST.HEADER_LENGTH;
    const headerArray = [
      ImageConverter.KORU_CONST.TXI_FILE_TYPE,
      ImageConverter.KORU_CONST.TXI_FILE_VERSION,
      imageDataLen,
      0, // data offset (bytes)
      formatType,
      this.rleEncode ? 0 : 1,
      this.width,
      this.height,
      imageDataLen,
      0xDEADBEEF, // image compression (unused by Koru)
    ];

    let p = 0;
    for (const val of headerArray) {
      this.view.setUint32(p, val, true);
      p += 4;
    }
  }

  convert(options = {}) {
    const { rle } = {
      rle: false,
      ...options,
    };
    this.rleEncode = rle;
     
    this.rle.reset(this.bytesPerPixel);
      
    const outputRows = !this.rleEncode ? this.height + 1 : this.height;
    const outputCols = !this.rleEncode ? this.width + 1 : this.width;
    let outputLength = outputCols * outputRows * 4;
    outputLength += ImageConverter.KORU_CONST.HEADER_LENGTH;

    this.p = ImageConverter.KORU_CONST.HEADER_LENGTH;
    this.view = new DataView(new ArrayBuffer(outputLength));
      
    let packed = null;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const [r, g, b, a] = this.image.getPixel(x, y);
        if (this.isGreyscale) {
          packed = [r];
        } else if (this.isRGB) {
          packed = this.rleEncode ? [a, b, g, r] : [b, g, r, a];
        } else {
          throw new Error(`Unrecognized color type ${this.colorType}`);
        }
        this._emit(packed);
      }
    }
    
    if (this.rleEncode) {
      const leftovers = this.rle.flush();
      if (leftovers) this._writeArray(leftovers);
    }

    this._writeHeader();

    return new Uint8Array(this.view.buffer.slice(0, this.p));
  }
}

export const convertPNGtoTXI = ImageConverter.convertPNGtoTXI;
