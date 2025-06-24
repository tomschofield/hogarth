import { Component, OnInit, NgZone, ElementRef } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { ManifestService } from './manifest.service';
import { AnnotationsService } from './annotations.service';
import { CanvasDatum } from './canvas-datum';
declare var OpenSeadragon: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})


export class AppComponent implements OnInit {
  title = 'hogarth';
  viewer: any;
  Mirador: any;
  config: any;
  panelText: string = "";
  canvasData: CanvasDatum[] = [];//| undefined;
  annotations: any[] = [];
  pageIndex: number = 0;
  panelTextIndex: number = 1;
  showingVideoTour: boolean = false;
  currentAnnotationIndex: number = 0;
  numPanels: number = 0;
  showingAnimations: boolean = false;

  constructor(private ngZone: NgZone, private manifestService: ManifestService, private annotationsService: AnnotationsService) { }
  ngOnInit() {


    this.manifestService.getData().subscribe(res => {
      this.config = res;
      console.log(res);
      this.config.sequences[0].canvases.forEach((element) => {
        let da: CanvasDatum = {
          id: element.images[0].resource.service["@id"],
          height: element.images[0].resource["height"],
          width: element.images[0].resource["width"]
        }
        this.canvasData.push(da);
      });

      let id: string = this.config.sequences[0].canvases[0].images[0].resource.service["@id"];
      let height: number = this.config.sequences[0].canvases[0].images[0].resource["height"];
      let width: number = this.config.sequences[0].canvases[0].images[0].resource["width"];



      let tileSources: any[] = [];
      this.canvasData.forEach(element => {
        tileSources.push({
          "@context": "http://iiif.io/api/image/2/context.json",
          "@id": "",
          "height": -1,
          "width": -1,
          "profile": ["http://iiif.io/api/image/2/level2.json"],
          "protocol": "http://iiif.io/api/image",
          "tiles": [{
            "scaleFactors": [1, 2, 4, 8, 16, 32],
            "width": 1024,

          }],
        })
      });
      let index: number = 0;
      this.canvasData.forEach(element => {
        tileSources[index]["@id"] = element["id"];
        tileSources[index]["height"] = element["height"];
        tileSources[index]["width"] = element["width"];
        index++;
      });
      this.viewer = new OpenSeadragon.Viewer({
        id: "seadragon-viewer",
        sequenceMode: true,
        showHomeControl: true,
        showZoomControl: false,
        showFullPageControl: true,
        showRotationControl: false,
        showFlipControl: false,
        showSequenceControl: true,
        navigatorBackground: "black",
        prefixUrl: "//openseadragon.github.io/openseadragon/images/",
        tileSources: tileSources

      });
      this.annotationsService.getData().subscribe(res => {

        this.annotations = res;
        this.addAnnotations(this.annotations);
      });

      this.viewer.addHandler('page',   (event: any) => {
       
        this.pageIndex=event.page;
        this.addAnnotations(this.annotations);
        //on page change remove old annotations and add new ones
      });



      this.viewer.addHandler('canvas-click', (event: any) => {
        var size = 0.2;

        if (event.quick) {

          var point = event.position;
          var vp = this.viewer.viewport.viewerElementToViewportCoordinates(point);
          var box = new OpenSeadragon.Rect(vp.x - size / 2, vp.y - size / 2, size, size);
          console.log(box)

        }
      });
      this.viewer.addHandler('open', function () {




      });
    },
      error => {
        console.log("Error happened" + error)
      }
    );

  }
  addAnnotations(data: any[]) {
    console.log("adding annotation hotspots");
    var index = 0;
    let titles:string[] = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];
    
    data.forEach(element => {
      
      //check that this annotation belongs to this painting
    
      if(  titles.indexOf(element["painting title"]) == this.pageIndex){
        this.addAnnotation(element.x, element.y, index);
      }
      index++;
    });

  }
  addAnnotation(x: number, y: number, index: number) {
    var elt = document.createElement("img");
    elt.src = "assets/icons/pin.png"
    elt.id = "annotation_" + index;
    this.currentAnnotationIndex = index;
    this.viewer.addOverlay({
      element: elt,
      location: new OpenSeadragon.Point(x, y),
      placement: 'BOTTOM',
      checkResize: false,
      width: 0.05,
      height: 0.05,
      index: index
    });
    new OpenSeadragon.MouseTracker({
      element: document.getElementById('annotation_' + index),
      clickHandler: e => this.setAnnotation(index),
    });
    this.panelTextIndex = 1;
  }
  setAnnotation(index: number) {
    //set the panel text
    this.panelText = this.annotations[index]["annotation text 1"];

    //determine how many panels there are
    let count: number = 0;
    if (this.annotations[index]["annotation text 1"].length > 0) this.numPanels = 1;
    if (this.annotations[index]["annotation text 2"].length > 0) this.numPanels = 2;
    if (this.annotations[index]["annotation text 3"].length > 0) this.numPanels = 3;
    if (this.annotations[index]["annotation text 4"].length > 0) this.numPanels = 4;

  }
  goBack() {
    if (this.panelTextIndex > 0) this.panelTextIndex--;
    this.panelText = this.annotations[this.currentAnnotationIndex]["annotation text " + this.panelTextIndex]
  }
  readMore() {


    if (this.panelTextIndex < this.numPanels) this.panelTextIndex++;
    this.panelText = this.annotations[this.currentAnnotationIndex]["annotation text " + this.panelTextIndex]
  }

  // Example usage in your toggleAnimation method:
  toggleAnimation(value) {
    console.log(value.checked);
    this.showingAnimations = value.checked;

    // Get the total number of pages/images
    const totalPages = this.canvasData.length;

    if (this.showingAnimations) {
      // Check if we're on the last image
      if (this.pageIndex === 0) {
        // Add video overlay when animations are enabled and we're on the last image
        this.addVideoOverlay(0.381, 0.581, 'assets/videos/boy.mp4', 0.158, 0.158);
      } else if (this.pageIndex === 3) {
        // Add video overlay when animations are enabled and we're on the last image
        this.addVideoOverlay(0.5, 0.5, 'assets/videos/goose.mp4', 0.3, 0.2);
      }
    } else {
      // Remove all overlays or specific video overlays
      const overlays = this.viewer.currentOverlays;
      overlays.forEach(overlay => {
        if (overlay.element.tagName === 'VIDEO') {
          this.viewer.removeOverlay(overlay.element);
        }
      });
    }
  }

  addVideoOverlay(x: number, y: number, videoUrl: string, width: number = 0.2, height: number = 0.2) {
    // Create video element
    const videoElement = document.createElement('video');
    videoElement.src = videoUrl;
    videoElement.controls = false; // Hide controls
    videoElement.autoplay = true; // Enable autoplay
    videoElement.muted = false; // Most browsers require muted for autoplay to work
    videoElement.loop = true; // Optional: make the video loop
    videoElement.style.backgroundColor = 'black';
    videoElement.id = 'video-overlay-' + Date.now();
    
    // Add the video as an overlay
    this.viewer.addOverlay({
      element: videoElement,
      location: new OpenSeadragon.Point(x, y),
      placement: 'CENTER',
      checkResize: false,
      width: width,
      height: height
    });
    
    return videoElement;
  }

}

