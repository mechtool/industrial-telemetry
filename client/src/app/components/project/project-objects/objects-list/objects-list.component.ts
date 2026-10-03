import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { ObjectNewComponent } from '../object-new/object-new.component';

interface ObjectRow {
  name: string;
  type: string;
  controller: string;
  status: string;
  updated: string;
}

const STATUS_COLORS: Record<string, string> = {
  'Онлайн': '#0fa97e',
  'Офлайн': '#8fa6bc',
  'Предупреждение': '#d98a16',
};

@Component({
  selector: 'app-objects-list',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, NzSelectModule, NzModalModule],
  templateUrl: './objects-list.component.html',
  styleUrl: './objects-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObjectsListComponent {
  private readonly modalService = inject(NzModalService);

  readonly typeOptions = ['Все типы', 'Насос', 'Холодильная камера', 'Горка', 'Баннет', 'Агрегат', 'Конденсаторный блок'];
  readonly statusOptions = ['Все статусы', 'Онлайн', 'Офлайн', 'Предупреждение'];

  readonly objects: ObjectRow[] = [
    { name: 'Насос #1', type: 'Насос', controller: 'CTR-001', status: 'Онлайн', updated: '12.05.2024, 08:32' },
    { name: 'Насос #2', type: 'Насос', controller: 'CTR-002', status: 'Офлайн', updated: '11.05.2024, 22:14' },
    { name: 'Холодильная камера A', type: 'Холодильная камера', controller: 'CTR-010', status: 'Онлайн', updated: '12.05.2024, 08:30' },
    { name: 'Холодильная камера B', type: 'Холодильная камера', controller: 'CTR-011', status: 'Предупреждение', updated: '12.05.2024, 07:55' },
    { name: 'Горка #1', type: 'Горка', controller: 'CTR-020', status: 'Онлайн', updated: '12.05.2024, 08:40' },
    { name: 'Баннет #3', type: 'Баннет', controller: 'CTR-031', status: 'Онлайн', updated: '12.05.2024, 08:15' },
    { name: 'Агрегат A', type: 'Агрегат', controller: 'CTR-040', status: 'Офлайн', updated: '10.05.2024, 16:03' },
    { name: 'Конденсаторный блок #1', type: 'Конденсаторный блок', controller: 'CTR-050', status: 'Онлайн', updated: '12.05.2024, 08:38' },
    { name: 'Конденсаторный блок #2', type: 'Конденсаторный блок', controller: 'CTR-051', status: 'Предупреждение', updated: '12.05.2024, 07:47' },
  ];

  openNewObject(): void {
    this.modalService.create({
      nzTitle: '',
      nzContent: ObjectNewComponent,
      nzFooter: null,
      nzWidth: 760,
      nzMaskClosable: false,
      nzBodyStyle: { padding: '24px 28px' },
    });
  }

  statusColor(status: string): string {
    return STATUS_COLORS[status] ?? '#8fa6bc';
  }
}
