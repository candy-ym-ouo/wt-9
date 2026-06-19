import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../entities';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
