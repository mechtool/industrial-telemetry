import { Component, inject, signal, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
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
    DialogModule, InputTextModule, SelectModule, TagModule, ToastModule,
    ConfirmDialogModule, ToolbarModule, SkeletonModule,
  ],
  providers: [ConfirmationService],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
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
    this.userForm.reset({ role: 'operator' });
    this.dialogVisible.set(true);
  }

  openEditDialog(user: User): void {
    this.editingUser.set(user);
    this.userForm.patchValue({
      username: user.username,
      email: user.email,
      role: user.role,
    });
    this.dialogVisible.set(true);
  }

  confirmDelete(user: User): void {
    this.confirmationService.confirm({
      message: `Удалить пользователя «${user.username}»?`,
      header: 'Подтверждение',
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteUser(user.id),
    });
  }

  deleteUser(id: string): void {
    this.usersService.deleteUser(id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Удалено', detail: 'Пользователь удалён' });
        this.loadUsers();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: err?.error?.error?.message ?? 'Не удалось удалить' });
      },
    });
  }

  saveUser(): void {
    if (this.userForm.invalid) return;
    this.saving.set(true);

    const payload: UserCreatePayload = this.userForm.value;
    const existing = this.editingUser();

    const request = existing
      ? this.usersService.updateUser(existing.id, payload)
      : this.usersService.createUser(payload);

    request.subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Готово', detail: existing ? 'Пользователь обновлён' : 'Пользователь создан' });
        this.saving.set(false);
        this.dialogVisible.set(false);
        this.loadUsers();
      },
      error: (err) => {
        this.messageService.add({ severity: 'error', summary: 'Ошибка', detail: err?.error?.error?.message ?? 'Не удалось сохранить' });
        this.saving.set(false);
      },
    });
  }

  resetForm(): void {
    this.userForm.reset({ role: 'operator' });
    this.editingUser.set(null);
  }
}