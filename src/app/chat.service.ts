import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { environment } from '../environments/environment';

export interface ChatMessage {
  content: string;
  role: 'user' | 'assistant';
  timestamp?: Date;
  character?: string; // Add character identification
  imageData?: string; // For image attachments
}

export interface ChatResponse {
  message: string;
  success: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl;
  private apiKey = environment.apiKey;
  private connectionId = environment.connectionId;
  private chatId: string | null = null;
  private currentCharacter: string = 'Hogarth'; // Default character

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey
    });
  }

  setCurrentCharacter(character: string) {
    this.currentCharacter = character;
    // Reset chat when switching characters
    this.chatId = null;
  }

  getCurrentCharacter(): string {
    return this.currentCharacter;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.status === 0) {
      // CORS or network error
      errorMessage = 'Unable to connect to the chat service. This may be due to network issues or server configuration.';
    } else if (error.status === 403) {
      errorMessage = 'Access denied. Please check your API credentials.';
    } else if (error.status === 404) {
      errorMessage = 'Chat service not found.';
    } else if (error.status >= 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    
    console.error('Chat error:', error);
    return throwError(() => new Error(errorMessage));
  }

  createChat(): Observable<any> {
    const payload = {
      user_id: "user_123",
      context: `You are ${this.currentCharacter} from William Hogarth's Election Series paintings. Respond in character, using the speaking style and knowledge appropriate to an 18th-century person. Be knowledgeable about the election corruption and social satire depicted in the paintings.`
    };

    return this.http.post(`${this.apiUrl}/integration/v1/chats?connection_id=${this.connectionId}`, payload, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  sendMessage(message: string, imageData?: string): Observable<any> {
    if (!this.chatId) {
      return this.createChat().pipe(
        switchMap((chatResponse: any) => {
          console.log('Chat created:', chatResponse);
          this.chatId = chatResponse.data.id;
          return this.sendMessageToChat(message, imageData);
        })
      );
    } else {
      return this.sendMessageToChat(message, imageData);
    }
  }

  private sendMessageToChat(message: string, imageData?: string): Observable<any> {
    const content: any[] = [
      {
        type: 'text',
        value: message
      }
    ];

    if (imageData) {
      content.push({
        type: 'image',
        value: imageData
      });
    }

    const payload = {
      source: 'user',
      content: content
    };

    return this.http.post(`${this.apiUrl}/integration/v1/chats/${this.chatId}/messages?connection_id=${this.connectionId}`, payload, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  testConnection(): Observable<any> {
    return this.http.get(`${this.apiUrl}/integration/v1?connection_id=${this.connectionId}`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError.bind(this))
    );
  }
}