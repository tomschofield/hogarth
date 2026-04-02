import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { MiradorTestComponent } from './mirador-test/mirador-test.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';
import { IntroComponent } from './intro/intro.component';
import { ViewerComponent } from './viewer/viewer.component';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatLegacyChipsModule } from '@angular/material/legacy-chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { A11yModule } from '@angular/cdk/a11y';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AcknowledgmentsModalComponent } from './acknowledgments-modal/acknowledgments-modal.component';
import { IntroModalComponent } from './intro-modal/intro-modal.component';
import { ChatService } from './chat.service';


@NgModule({
  declarations: [
    AppComponent,
    MiradorTestComponent,
    IntroComponent,
    ViewerComponent,
    AcknowledgmentsModalComponent,
    IntroModalComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    HttpClientModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatDividerModule, 
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatLegacyChipsModule, // Add this for mat-chip-list
    MatTooltipModule, // Add this for tooltips
    FormsModule,
    MatProgressBarModule,
    DragDropModule,
    A11yModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  providers: [
    ChatService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
