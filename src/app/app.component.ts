import { Component, OnInit, NgZone, ElementRef } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { ManifestService } from './manifest.service';
import { AnnotationsService } from './annotations.service';
import { AnimationsService } from './animations.service';
import { CanvasDatum } from './canvas-datum';
declare var OpenSeadragon: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
//TODO why is the goose appearing before show animations checked? 
//TODO why does the second annotation show read more on the last panel when it shouldnt'? - it's defo somethng to do with the page index not being right because its stukc on teh first panel

export class AppComponent implements OnInit {
  title = 'hogarth';
  viewer: any;
  Mirador: any;
  config: any;
  panelText: string = "";
  canvasData: CanvasDatum[] = [];//| undefined;
  annotations: any[] = [];
  animations: any[] = [];
  pageIndex: number = 0;
  panelTextIndex: number = 0;
  showingVideoTour: boolean = false;
  currentAnnotationIndex: number = 0;
  numPanels: number = 0;
  showingAnimations: boolean = false;
  showingAnnotations: boolean = true;

  animationIndex: number = 0;
  numAnimations: number = 0;

  constructor(private ngZone: NgZone, private manifestService: ManifestService, private annotationsService: AnnotationsService, private animationsService: AnimationsService) { }
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

      //   fullPageButton: "full-page",
      // nextButton:     "next",
      // previousButton: "previous",
      this.viewer = new OpenSeadragon.Viewer({
        id: "seadragon-viewer",
        homeButton: "home",
        fullPageButton: "full-page",
        nextButton: "next",
        previousButton: "previous",
        sequenceMode: true,
        showHomeControl: true,
        blendTime: 0.5,
        showZoomControl: false,
        showFullPageControl: true,
        showRotationControl: false,
        showFlipControl: false,
        showSequenceControl: true,
        navigatorBackground: "black",
        prefixUrl: "//openseadragon.github.io/openseadragon/images/",
        tileSources: tileSources

      });

      //fetch annotation json
      this.annotationsService.getData().subscribe(res => {

        this.annotations = res;
        //let's find the image links and add them into the body text

        for (var i = 0; i < this.annotations.length; i++) {

          if (this.annotations[i]["image filename 0"].length > 0) {
            this.annotations[i]["annotation text 0"] = this.annotations[i]["annotation text 0"] + "  <img width='100%' class='panelImage'src='assets/panelImages/" + this.annotations[i]["image filename 0"] + "'/>";
          }
          if (this.annotations[i]["image filename 1"].length > 0) {
            this.annotations[i]["annotation text 1"] = this.annotations[i]["annotation text 1"] + "  <img width='100%' class='panelImage'src='assets/panelImages/" + this.annotations[i]["image filename 1"] + "'/>";
          }
          if (this.annotations[i]["image filename 2"].length > 0) {
            this.annotations[i]["annotation text 2"] = this.annotations[i]["annotation text 2"] + "  <img width='100%' class='panelImage'src='assets/panelImages/" + this.annotations[i]["image filename 2"] + "'/>";
          }
          if (this.annotations[i]["animation index"] !=-1) {
            console.log("setting animation link");
            //find the last panel text
            let np: number = 0;
            if (this.annotations[i]["annotation text 0"].length > 0) np = 1;
            if (this.annotations[i]["annotation text 1"].length > 0) np = 2;
            if (this.annotations[i]["annotation text 2"].length > 0) np = 3;
            if (this.annotations[i]["annotation text 3"].length > 0) np = 4;
            np-=1;
          //  this.annotations[i]["annotation text "+np]+='<button class="mat-button" mat-raised-button  (click)="jumpToAnimation(' + this.annotations[i]["animation index"] + ')">ANIMATION LINK</button>'
      
            //console.log(np, this.annotations[i]["annotation text "+np]);
            //    this.jumpToAnimation(this.annotations[i]["animation index"]);
          }
        }



        this.addAnnotations(this.annotations);
      });

      //fetch animation json
      this.animationsService.getData().subscribe(res => {

        this.animations = res;
        this.numAnimations = this.animations.length;
        //this.addAnimations(this.animations);
      });

      //fires when page turns
      this.viewer.addHandler('page', (event: any) => {

        this.pageIndex = event.page;
        this.panelText = "";
        console.log("now on page ", this.pageIndex);
        // this.numAnimations=0;
        //this.animationIndex=0;
        this.addAnnotations(this.annotations);
        // this.addAnimations(this.animations);
        //on page change remove old annotations and add new ones
      });



      this.viewer.addHandler('canvas-click', (event: any) => {
        var size = 0.2;

        if (event.quick) {
          // console.log(event.position);

          var point = event.position;
          console.log("point", point);
          var vp = this.viewer.viewport.viewerElementToViewportCoordinates(point);
          console.log("Vp", vp);
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
  move(x: number, y: number, width: number, height: number) {



    var box = new OpenSeadragon.Rect(x - (width / 2), y - (width / 2), width, height);

    this.viewer.viewport.fitBounds(box);//,OpenSeadragon.Placement.CENTER,false);
  }
  addAnimations(data: any[]) {
    console.log("adding animation hotspots");
    console.log(data);
    var index = 0;
    data.forEach(element => {

      //check that this annotation belongs to this painting

      if (element.canvasIndex == this.pageIndex) {
        this.addVideoOverlay(element.x, element.y, element.videoUrl, element.width, element.height)
      }
      index++;
    });
  }

  addAnnotations(data: any[]) {
    console.log("adding annotation hotspots");
    var index = 0;
    let titles: string[] = ["An Election Entertainment", "Canvassing for Votes", "The Polling", "Chairing the Member"];

    data.forEach(element => {

      //check that this annotation belongs to this painting

      if (titles.indexOf(element["painting title"]) == this.pageIndex) {
        this.addAnnotation(element.x, element.y, index, element["annotation type"]);

      }
      index++;
    });

  }
  addAnnotation(x: number, y: number, index: number, type: string) {
    var elt = document.createElement("img");
    if (type === "multi-level") {
      elt.src = "assets/icons/pin.png"
    } else {
      elt.src = "assets/icons/pin_blue.png"
    }

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
    this.panelTextIndex = 0;
     if (this.annotations[this.currentAnnotationIndex]["annotation text 0"].length > 0) this.numPanels = 1;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 1"].length > 0) this.numPanels = 2;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 2"].length > 0) this.numPanels = 3;
    if (this.annotations[this.currentAnnotationIndex]["annotation text 3"].length > 0) this.numPanels = 4;
  }

  removeAnnotations() {
    const overlays = this.viewer.currentOverlays;
    overlays.forEach(overlay => {
      if (overlay.element.tagName === 'IMG') {
        this.viewer.removeOverlay(overlay.element);
      }
    });
  }
  removeAnimations() {
    const overlays = this.viewer.currentOverlays;
    overlays.forEach(overlay => {
      if (overlay.element.tagName === 'VIDEO') {
        this.viewer.removeOverlay(overlay.element);
      }
    });
  }
  setAnnotation(index: number) {
    //set the panel text
    this.panelText = this.formatPanelText(this.annotations[index]["annotation text 0"]);

    //image filename 1
    //if (this.annotations[index]["image filename 1"].length > 0) this.numPanels = 1;

    //determine how many panels there are
    let count: number = 0;

    if (this.annotations[index]["annotation text 0"].length > 0) this.numPanels = 1;
    if (this.annotations[index]["annotation text 1"].length > 0) this.numPanels = 2;
    if (this.annotations[index]["annotation text 2"].length > 0) this.numPanels = 3;
    if (this.annotations[index]["annotation text 3"].length > 0) this.numPanels = 4;

  }
  jumpToAnimation(index: number) {
    console.log("jumping to animation #", index);
    this.animationIndex=index;
    this.showingAnnotations = false;
    this.showingAnimations = true;
    this.setAnimation();
    //this.toggleAnimation(true);
  }

  setAnimation() {
    this.viewer.clearOverlays();
    let currentAnimation: any[] = [];


    //find the animation that matches the current page and where we are in the animation queue
    this.animations.forEach(element => {
      if (element.storyIndex == this.animationIndex && element.canvasIndex == this.pageIndex) {
        currentAnimation.push(element);
      }
    });

    this.move(currentAnimation[0].x, currentAnimation[0].y, currentAnimation[0].width, currentAnimation[0].height);
    setTimeout(() => {
      this.addAnimations(currentAnimation);
    }, 500);


  }
  goBack() {
    if (this.showingAnimations) {
      if (this.animationIndex > 0) {
        this.animationIndex--;
        if (this.animations[this.animationIndex].canvasIndex != this.pageIndex) {
          this.viewer.goToPage(this.animations[this.animationIndex].canvasIndex);
        }
        this.setAnimation();

      }

    }
    else {
      if (this.panelTextIndex > 0) this.panelTextIndex--;
      console.log("num panels", this.numPanels);
      console.log("panelTextIndex", this.panelTextIndex);

      this.panelText = this.formatPanelText(this.annotations[this.currentAnnotationIndex]["annotation text " + this.panelTextIndex]);
    }

  }



  formatPanelText(text: string) {
    let exploded: string[] = text.split(" ");
    let formatted: string = "";

    exploded.forEach(element => {
      if (element.search("http") != -1) {

        let link: string = "<a href='" + element + "'>(here)</a>";
        formatted += link + " ";
      }
      else {
        formatted += element + " ";
      }
    });
    return formatted;
  }

  readMore() {
    if (this.showingAnimations) {
      this.animationIndex++;
      //move to next page if new animation page doesn't match teh page we're on
      if (this.animations[this.animationIndex].canvasIndex != this.pageIndex) {
        this.viewer.goToPage(this.animations[this.animationIndex].canvasIndex);

      }

      this.setAnimation();

    }
    else {
      
      if (this.panelTextIndex < this.numPanels) this.panelTextIndex++;
      console.log("num panels", this.numPanels);
      console.log("panelTextIndex", this.panelTextIndex);
      this.panelText = this.formatPanelText(this.annotations[this.currentAnnotationIndex]["annotation text " + this.panelTextIndex]);
    }


  }
  toggleAnnotation(value) {
    this.viewer.clearOverlays();
    if (value.checked) {
      this.addAnnotations(this.annotations);
      this.showingAnimations = false;
    }
    else {
      this.viewer.clearOverlays();
    }
  }

  toggleAnimation(value) {
    //remove overlays doesn't actually quite do that
    this.viewer.clearOverlays();


    this.showingAnimations = value.checked;

    // Get the total number of pages/images
    const totalPages = this.canvasData.length;

    if (this.showingAnimations) {
      this.showingAnnotations = false;
      this.setAnimation();



    } else {

      this.addAnnotations(this.annotations);
      // Remove all overlays or specific video overlays

    }
  }

  addVideoOverlay(x: number, y: number, videoUrl: string, width: number = 0.2, height: number = 0.2) {
    // Create video element
    const videoElement = document.createElement('video');
    videoElement.src = videoUrl;
    videoElement.controls = false; // Hide controls
    videoElement.autoplay = true; // Enable autoplay
    videoElement.muted = false; // Most browsers require muted for autoplay to work
    videoElement.loop = false; // Optional: make the video loop
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

