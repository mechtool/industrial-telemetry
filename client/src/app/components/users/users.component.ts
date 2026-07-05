import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { SkeletonModule } from 'primeng/skeleton';
import { UsersService, User, UserCreatePayload } from '../../services/users.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TableModule, ButtonModule,
    DialogModule, InputTextModule, DropdownModule, TagModule, ToastModule,
    ConfirmDialogModule, ToolbarModule, SkeletonModule,
  ],
  providers: [ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="page-container">
      <div class="flex justify-content-between align-items-center mb-3">
        <h1 class="page-title" style="margin-bottom:0">Пользователи</h1>
        <p-button label="Добавить" icon="pi pi-plus" severity="success" (onClick)="openCreateDialog()" />
      </div>

      <p-toolbar styleClass="mb-3">
        <ng-template pTemplate="left">
          <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <input
              pInputText
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearch($event)"
              placeholder="Поиск..."
              style="width: 250px"
            />
          </span>
        </ng-template>
        <ng-template pTemplate="right">
          <p-button icon="pi pi-refresh" severity="secondary" (onClick)="loadUsers()" />
        </ng-template>
      </p-toolbar>

      @if (!loading()) {
        <p-table
          [value]="users()"
          [paginator]="true"
          [rows]="20"
          [totalRecords]="totalRecords()"
          [lazy]="true"
          (onLazyLoad)="onLazyLoad($event)"
          [rowsPerPageOptions]="[10, 20, 50]"
          styleClass="p-datatable-striped p-datatable-sm"
          responsiveLayout="scroll"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Имя</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Статус</th>
              <th>Создан</th>
              <th style="width:120px">Действия</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-user>
            <tr>
              <td>{{ user.username }}</td>
              <td>{{ user.email }}</td>
              <td>
                <p-tag
                  [value]="user.role"
                  [severity]="user.role === 'admin' ? 'danger' : user.role === 'engineer' ? 'warning' : 'info'"
                />
              </td>
              <td>
                <p-tag [value]="user.isActive ? 'Активен' : 'Неактивен'" [severity]="user.isActive ? 'success' : 'secondary'" />
              </td>
              <td>{{ user.createdAt | date:'dd.MM.yyyy' }}</td>
              <td>
                <div class="flex gap-1">
                  <p-button icon="pi pi-pencil" severity="info" size="small" [rounded]="true" (onClick)="openEditDialog(user)" />
                  <p-button icon="pi pi-trash" severity="danger" size="small" [rounded]="true" (onClick)="confirmDelete(user)" />
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      } @else {
        <div class="flex flex-column gap-3">
          @for (i of [1,2,3,4,5]; track i) {
            <p-skeleton width="100%" height="40px" />
          }
        </div>
      }
    </div>

    <!-- Диалог создания/редактирования -->
    <p-dialog
      [header]="editingUser() ? 'Редактировать пользователя' : 'Новый пользователь'"
      [(visible)]="dialogVisible"
      [modal]="true"
      styleClass="w-30rem"
      (onHide)="resetForm()"
    >
      <form [formGroup]="userForm" (ngSubmit)="saveUser()" class="flex flex-column gap-3">
        <div class="flex flex-column gap-1">
          <label for="username" class="text-sm font-medium">Имя пользователя *</label>
          <input id="username" pInputText formControlName="username" autocomplete="off" />
        </div>
        <div class="flex flex-column gap-1">
          <label for="email" class="text-sm font-medium">Email *</label>
          <input id="email" pInputText formControlName="email" type="email" autocomplete="off" />
        </div>
        <div class="flex flex-column gap-1">
          <label for="role" class="text-sm font-medium">Роль *</label>
          <p-dropdown
            id="role"
            formControlName="role"
            [options]="roleOptions"
            styleClass="w-full"
          />
        </div>
        <div class="flex justify-content-end gap-2 mt-2">
          <p-button label="Отмена" severity="secondary" (onClick)="dialogVisible.set(false); resetForm()" />
          <p-button label="Сохранить" type="submit" [disabled]="userForm.invalid || saving()" [loading]="saving()" />
        </div>
      </form>
    </p-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb = inject(FormBuilder);

  users = signal<User[]>([]);
  loading = signal(true);
  saving = signal(false);
  totalRecords = signal(0);
  searchTerm = signal('');
  dialogVisible = signal(false);
  editingUser = signal<User | null>(null);

  currentPage = 1;
  currentLimit = 20;

  roleOptions = [
    { label: 'Оператор', value: 'operator' },
    { label: 'Инженер', value: 'engineer' },
    { label: 'Администратор', value: 'admin' },
  ];

  userForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(64)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['operator', Validators.required],
  });

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.usersService.getUsers(this.currentPage, this.currentLimit, this.searchTerm()).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.totalRecords.set(res.pagination?.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось загрузить пользователей' });
        this.loading.set(false);
      },
    });
  }

  onLazyLoad(event: TableLazyLoadEvent): void {
    this.currentPage = (event.first ?? 0) / (event.rows ?? 20) + 1;
    this.currentLimit = event.rows ?? 20;
    this.loadUsers();
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPage = 1;
    this.loadUsers();
  }

  openCreateDialog(): void {
    this.editingUser.set(null);
    this.userForm.reset({ username: '', email: '', role: 'operator' });
    this.dialogVisible.set(true);
  }

  openEditDialog(user: User): void {
    this.editingUser.set(user);
    this.userForm.patchValue({ username: user.username, email: user.email, role: user.role });
    this.dialogVisible.set(true);
  }

  saveUser(): void {
    if (this.userForm.invalid) return;
    this.saving.set(true);

    const payload: UserCreatePayload = this.userForm.value;
    const editId = this.editingUser()?.id;

    const req = editId
      ? this.usersService.updateUser(editId, payload)
      : this.usersService.createUser(payload);

    req.subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success', summary: 'Успех',
          detail: editId ? 'Пользователь обновлён' : 'Пользователь создан',
        });
        this.dialogVisible.set(false);
        this.saving.set(false);
        this.loadUsers();
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error', summary: 'Ошибка',
          detail: err?.error?.error?.message ?? 'Не удалось сохранить',
        });
        this.saving.set(false);
      },
    });
  }

  confirmDelete(user: User): void {
    this.confirmationService.confirm({
      message: `Удалить пользователя «${user.username}»?`,
      header: 'Подтверждение',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Удалить',
      rejectLabel: 'Отмена',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteUser(user.id),
    });
  }

  deleteUser(id: string): void {
    this.usersService.deleteUser(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Успех', detail: 'Пользователь удалён' });
        this.loadUsers();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: 'Не удалось удалить' });
      },
    });
  }

  resetForm(): void {
    this.userForm.reset({ username: '', email: '', role: 'operator' });
    this.editingUser.set(null);
  }
}
