import document from "document";
import { inbox } from "file-transfer"
import * as messaging from "messaging";

messaging.peerSocket.onopen = function() {
  console.log("open")
}

// Event occurs when new file(s) are received
inbox.onnewfile = function () {
  var fileName;
  do {
    // If there is a file, move it from staging into the application folder
    fileName = inbox.nextFile();
    if (fileName) {
      console.log("/private/data/" + fileName + " is now available");
      document.getElementById("generated").href = "/private/data/" + fileName;
    }
  } while (fileName);
};
