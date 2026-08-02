import { Component, OnInit, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { KratosService } from './services/kratos.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  readonly kratosService = inject(KratosService);

  ngOnInit(): void {
    this.kratosService.checkSession().subscribe();
  }
}
