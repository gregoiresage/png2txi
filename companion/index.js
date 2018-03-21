import * as messaging from "messaging";
import { outbox } from "file-transfer"
import { readPNG, convertPNGtoTXI } from "../common/ImageConverter.js";

messaging.peerSocket.onopen = function() {
  console.log("open")
  fetch("https://vignette.wikia.nocookie.net/theteamfortress2/images/1/16/Chiefofstaff-300x300.png").then(response => {
      return response.arrayBuffer()
  }).then(buffer => {
     return readPNG(buffer)
  }).then(data => {
     return convertPNGtoTXI(data)
  }).then(data => {
      return outbox.enqueue("image.png.txi", data).then(function (ft) {
        // Queued successfully
        console.log("Transfer of 'image successfully queued.");
      }).catch(function (error) {
        // Failed to queue
        throw new Error("Failed to queue image. Error: " + error);
      });
  })
}


