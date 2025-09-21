import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-intro-modal',
  templateUrl: './intro-modal.component.html',
  styleUrls: ['./intro-modal.component.scss']
})
export class IntroModalComponent {
  @Input() isOpen: boolean = false;
  @Input() paintingIndex: number = 0;
  @Output() closeModal = new EventEmitter<void>();

  paintingIntros = [
    {
      title: "An Election Entertainment",
      content: `Welcome to the first painting in Hogarth's 'Humours of an Election' series.

This scene, painted in 1754-55, depicts the first stage of an election for parliament in 18th-century England. One party hosts a lavish feast, designed to buy people's votes. It's chaos around the dinner table, as well as in the street outside the tavern.

Take a look round the painting, and zoom in to explore its details. Animate the characters, and listen to what they have to say. Or click on the annotation pins to learn more about the history, and the meanings of Hogarth's satire.`
    },
    {
      title: "Canvassing for Votes", 
      content: `This is the second painting in the series, with the action taking place outside three country pubs.

We see attempts to buy votes in full swing. Politicians and their agents are seeking support by offering bribes, making promises and manipulating opinion.

Explore further by listening to the characters or exploring details of the scene through the annotations.`
    },
    {
      title: "The Polling",
      content: `Here, in the third painting, the election has arrived. Hogarth shows the actual voting process as people cast their 'polls'. It's a public event, taking place in the open, but Hogarth makes it clear that this is another scene of dispute and corruption.`
    },
    {
      title: "Chairing the Member", 
      content: `Here we are shown the aftermath of the election, with the newly elected Members of Parliament being carried through the streets in a traditional 'chairing' celebration. Hogarth shows this moment of triumph descending into chaos, violence and disaster.

The painting completes the cycle, showing how the corruption depicted throughout the series has fatally undermined the political system. But it's also a vibrant scene, where the whole community wants to play a part in the election. Whether they can vote or not, these are all people for whom elections matter.`
    }
  ];

  get currentIntro() {
    return this.paintingIntros[this.paintingIndex] || this.paintingIntros[0];
  }

  onCloseModal() {
    this.closeModal.emit();
  }

  onOverlayClick(event: Event) {
    // Close modal when clicking on overlay (not the modal content)
    if (event.target === event.currentTarget) {
      this.onCloseModal();
    }
  }
}