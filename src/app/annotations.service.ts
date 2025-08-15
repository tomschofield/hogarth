import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AnnotationsService {

  constructor(private http: HttpClient) { }
  configUrl: string = "assets/data/annotations.json";
  getData() {
    return this.http.get<any>(this.configUrl);
  }
}
