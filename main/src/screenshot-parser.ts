import { app, desktopCapturer, NativeImage, Point, Rectangle } from "electron"
import fs from "fs";
import path from "path";
import { config } from "./config";
import { D2RWindow } from "./D2RWindow";
import { logger } from "./logger";
import { recognize } from "node-native-ocr";
import { cv } from 'opencv-wasm'
import Jimp from 'jimp'

export const attemptToParseScreenShot = async (point: Point) => {
  logger.info('Attempting to take screenshot');
  desktopCapturer.getSources({ 
    types: ['window'],
    thumbnailSize: {
      height: D2RWindow.bounds.height,
      width: D2RWindow.bounds.width,
    }
  }).then(async sources => {
    for (const source of sources) {
      logger.debug(source.name);
      if (source.name === config.get('windowTitle')) {
        logger.debug('Found D2R Window')
        console.log(JSON.stringify(D2RWindow.bounds));
      
        const image: NativeImage = source.thumbnail;
        detectRectangle(image);

        fs.writeFileSync(path.join(app.getPath('userData'), 'apt-data', 'test.jpg'), image.toJPEG(100));
        // parseTextFromScreenshot(image.toJPEG(100), point);
      }
    }
  })
//   const window = D2RWindow.attachedWindow;
//   if (window) {
//     window.webContents.capturePage(window.getBounds()).then(image => {
//       fs.writeFileSync(path.join(app.getPath('userData'), 'apt-data', 'test.png'), image.toPNG())
//     });
//   } else {
//     logger.error('Could not find handle to attached window');
//   }
}

const cropImageRightHalf = (image: NativeImage) => (
  image.crop({
    width: D2RWindow.bounds.width / 2,
    height: D2RWindow.bounds.height,
    x: D2RWindow.bounds.width / 2,
    y: 0
  })
)

const parseTextFromScreenshot = async (imageBuffer: Buffer, point: Point) => {
  recognize(imageBuffer, {lang: 'eng', output: 'tsv'}).then(logger.debug).catch((err: any) => logger.error(JSON.stringify(err)));
}

const detectRectangle = async (image: NativeImage): Promise<Rectangle> => {
  let mat = cv.matFromImageData({
    data: image.toBitmap(),
    width: image.getSize().width,
    height: image.getSize().height
  });
  let dst = new cv.Mat();
  cv.cvtColor(mat, dst, cv.COLOR_RGB2GRAY, 0)

  // TODO Move this to pre-processing for OCR
  // It removes a lot of the noise in the background of the image
  //cv.threshold(dst, dst, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)

  cv.threshold(dst, dst, 50, 255, cv.THRESH_BINARY)
  const tmp = new cv.Mat();
  cv.cvtColor(dst, tmp, cv.COLOR_GRAY2RGB, 0)
  await new Jimp({
    width: tmp.cols,
    height: tmp.rows,
    data: Buffer.from(tmp.data)
  }).writeAsync(path.join(app.getPath('userData'), 'apt-data', 'test.thresh.jpg'))


  cv.Canny(dst, dst, 75, 100, 3, false);
  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.findContours(dst, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  console.log('Num contours: ' + contours.size());
  cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGB, 0)
  for (let i = 0; i < contours.size(); i++) {
    const rect = cv.boundingRect(contours.get(i));
    console.log(rect)
    const color = new cv.Scalar(Math.random() * 255, Math.random() * 255, Math.random() * 255)
    cv.rectangle(
      dst,
      new cv.Point(rect.x, rect.y),
      new cv.Point(rect.x + rect.width, rect.y + rect.height),
      color,
      2,
      cv.LINE_AA,
      0
    )
  }
  await new Jimp({
    width: dst.cols,
    height: dst.rows,
    data: Buffer.from(dst.data)
  }).writeAsync(path.join(app.getPath('userData'), 'apt-data', 'test.rect.jpg'))
  // let lines = new cv.Mat();



  // cv.HoughLinesP(dst, lines, 1, Math.PI / 180, 5, image.getSize().height / 20, 0)



  // console.log('Num lines: ' + lines.rows);
  // cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGB, 0)
  // await new Jimp({
  //   width: dst.cols,
  //   height: dst.rows,
  //   data: Buffer.from(dst.data)
  // }).writeAsync(path.join(app.getPath('userData'), 'apt-data', 'test.canny.jpg'))
  
  // for (let i = 0; i < lines.rows; i++) {
  //   const color = new cv.Scalar(Math.random() * 255, Math.random() * 255, Math.random() * 255)
  //   cv.line(
  //     dst,
  //     new cv.Point(lines.data32S[i * 4], lines.data32S[i * 4 + 1]),
  //     new cv.Point(lines.data32S[i * 4 + 2], lines.data32S[i * 4 + 3]),
  //     color
  //   )
  // }
  // await new Jimp({
  //   width: dst.cols,
  //   height: dst.rows,
  //   data: Buffer.from(dst.data)
  // }).writeAsync(path.join(app.getPath('userData'), 'apt-data', 'test.canny.lines.jpg'))
  
  mat.delete()
  dst.delete()
  // lines.delete();
  return {
    x: 0,
    y: 0,
    width: image.getSize().width,
    height: image.getSize().height
  }
}