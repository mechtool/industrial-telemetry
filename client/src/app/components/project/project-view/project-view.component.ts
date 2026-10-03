import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { ProjectsUiService } from '../../../services/projects-ui.service';
import { UsersUiService } from '../../../services/users-ui.service';
import { ObjectsUiService } from '../../../services/objects-ui.service';
import { OrganizationsUiService } from '../../../services/organizations-ui.service';
import { GatewaysUiService } from '../../../services/gateways-ui.service';
import { ProjectGeneralComponent } from '../project-general/project-general.component';
import { ProjectDashboardComponent } from '../project-dashboard/project-dashboard.component';
import { UsersListComponent } from '../project-users/users-list/users-list.component';
import { UsersEmptyComponent } from '../project-users/users-empty/users-empty.component';
import { ObjectsListComponent } from '../project-objects/objects-list/objects-list.component';
import { ObjectEmptyComponent } from '../project-objects/object-empty/object-empty.component';
import { OrganizationsListComponent } from '../organizations/organizations-list/organizations-list.component';
import { OrganizationsEmptyComponent } from '../organizations/organizations-empty/organizations-empty.component';
import { GatewaysListComponent } from '../gateways/gateways-list/gateways-list.component';
import { GatewaysEmptyComponent } from '../gateways/gateways-empty/gateways-empty.component';

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    ProjectGeneralComponent,
    ProjectDashboardComponent,
    UsersListComponent,
    UsersEmptyComponent,
    ObjectsListComponent,
    ObjectEmptyComponent,
    OrganizationsListComponent,
    OrganizationsEmptyComponent,
    GatewaysListComponent,
    GatewaysEmptyComponent,
  ],
  templateUrl: './project-view.component.html',
  styleUrl: './project-view.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectViewComponent implements OnInit {
  private readonly ui = inject(ProjectsUiService);
  readonly usersUi = inject(UsersUiService);
  readonly objectsUi = inject(ObjectsUiService);
  readonly organizationsUi = inject(OrganizationsUiService);
  readonly gatewaysUi = inject(GatewaysUiService);

  readonly projectName = 'Холод-Логистик Север';
  readonly projectCode = 'PRJ-1042';

  readonly tabs = ['Общие', 'Панель управления', 'Объекты', 'Данные', 'Шлюзы', 'Организации', 'Триггеры', 'Пользователи'];

  readonly selectedTab = signal('Общие');
  readonly isUsersTab = computed(() => this.selectedTab() === 'Пользователи');
  readonly isDashboardTab = computed(() => this.selectedTab() === 'Панель управления');
  readonly isObjectsTab = computed(() => this.selectedTab() === 'Объекты');
  readonly isOrganizationsTab = computed(() => this.selectedTab() === 'Организации');
  readonly isGatewaysTab = computed(() => this.selectedTab() === 'Шлюзы');

  ngOnInit(): void {
    this.ui.isProjectView.set(true);
  }
}
