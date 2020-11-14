import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
// import { CheckInService } from '@app/core/services/check-in.service';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-qr-modal',
  templateUrl: './qr-modal.component.html',
  styleUrls: ['./qr-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QrModalComponent implements OnInit {

  constructor(
    private readonly modalController: ModalController,
    // public readonly checkInService: CheckInService
  ) { }

  ngOnInit() {}

}
