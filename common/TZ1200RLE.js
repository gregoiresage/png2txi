const MAX_SECTION_LENGTH = 127;

export default class TZ1200RLE {
  reset(bytesPerPixel) {
    this.section = new ArrayBuffer((MAX_SECTION_LENGTH * bytesPerPixel) + 1);
    this.lastPixel = null;
    this.pixelCount = 0;
    this.sectionIndex = 1;
    this.willCompress = false;
  }

  writePixelToSection(pixel) {
    const view = new DataView(this.section);
    for (const byte of pixel) {
      view.setUint8(this.sectionIndex, byte);
      this.sectionIndex += 1;
    }
    this.pixelCount += 1;
  }

  get isSectionFull() {
    return this.pixelCount === MAX_SECTION_LENGTH;
  }

  comparePixel(pixel) {
    if (!pixel || !this.lastPixel) return false;
    for (let i = 0; i < pixel.length; i += 1) {
      if (pixel[i] !== this.lastPixel[i]) return false;
    }
    return true;
  }

  flush() {
    if (!this.willCompress && this.lastPixel) {
      this.writePixelToSection(this.lastPixel);
    }
    return this.__flush();
  }

  __flush() {
    let out = null;
    if (this.pixelCount > 0) {
      out = new Uint8Array(this.section.slice(0, this.sectionIndex));
      out[0] = this.willCompress ? (MAX_SECTION_LENGTH + 1) : 0;
      out[0] |= this.pixelCount & MAX_SECTION_LENGTH;
    }
    this.pixelCount = 0;
    this.sectionIndex = 1;
    return out;
  }

  encode(pixel) {
    let out = null;

    if (this.willCompress) {
      if (this.comparePixel(pixel)) {
        this.pixelCount += 1;

        if (this.isSectionFull) {
          out = this.__flush();
          this.willCompress = false;
          this.lastPixel = null;
        }
      } else {
        out = this.__flush();
        this.willCompress = false;
        this.lastPixel = pixel;
      }
    } else if (this.comparePixel(pixel)) {
      out = this.__flush();
      this.willCompress = true;
      this.sectionIndex = 1;
      this.writePixelToSection(this.lastPixel);
      this.pixelCount = 2;
    } else {
      if (this.lastPixel) this.writePixelToSection(this.lastPixel);
      if (this.isSectionFull) out = this.__flush();

      this.lastPixel = pixel;
    }
    return out;
  }
}
