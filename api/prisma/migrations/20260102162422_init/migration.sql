-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `cognitoSub` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AdminUser_cognitoSub_key`(`cognitoSub`),
    UNIQUE INDEX `AdminUser_email_key`(`email`),
    INDEX `AdminUser_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminRole` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AdminRole_key_key`(`key`),
    INDEX `AdminRole_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminPermission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(64) NOT NULL,
    `name` VARCHAR(128) NOT NULL,
    `description` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AdminPermission_key_key`(`key`),
    INDEX `AdminPermission_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminUserRole` (
    `id` VARCHAR(191) NOT NULL,
    `adminUserId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedByAdminUserId` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByAdminUserId` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdminUserRole_adminUserId_idx`(`adminUserId`),
    INDEX `AdminUserRole_roleId_idx`(`roleId`),
    INDEX `AdminUserRole_revokedAt_idx`(`revokedAt`),
    INDEX `AdminUserRole_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `AdminUserRole_adminUserId_roleId_key`(`adminUserId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminRolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `grantedByAdminUserId` VARCHAR(191) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokedByAdminUserId` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdminRolePermission_roleId_idx`(`roleId`),
    INDEX `AdminRolePermission_permissionId_idx`(`permissionId`),
    INDEX `AdminRolePermission_revokedAt_idx`(`revokedAt`),
    INDEX `AdminRolePermission_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `AdminRolePermission_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminRbacAuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actorAdminUserId` VARCHAR(191) NULL,
    `targetAdminUserId` VARCHAR(191) NULL,
    `roleId` VARCHAR(191) NULL,
    `permissionId` VARCHAR(191) NULL,
    `ip` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `metadata` TEXT NULL,

    INDEX `AdminRbacAuditEvent_at_idx`(`at`),
    INDEX `AdminRbacAuditEvent_action_idx`(`action`),
    INDEX `AdminRbacAuditEvent_actorAdminUserId_idx`(`actorAdminUserId`),
    INDEX `AdminRbacAuditEvent_targetAdminUserId_idx`(`targetAdminUserId`),
    INDEX `AdminRbacAuditEvent_roleId_idx`(`roleId`),
    INDEX `AdminRbacAuditEvent_permissionId_idx`(`permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminUserRole` ADD CONSTRAINT `AdminUserRole_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUserRole` ADD CONSTRAINT `AdminUserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `AdminRole`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUserRole` ADD CONSTRAINT `AdminUserRole_assignedByAdminUserId_fkey` FOREIGN KEY (`assignedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminUserRole` ADD CONSTRAINT `AdminUserRole_revokedByAdminUserId_fkey` FOREIGN KEY (`revokedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRolePermission` ADD CONSTRAINT `AdminRolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `AdminRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRolePermission` ADD CONSTRAINT `AdminRolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `AdminPermission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRolePermission` ADD CONSTRAINT `AdminRolePermission_grantedByAdminUserId_fkey` FOREIGN KEY (`grantedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRolePermission` ADD CONSTRAINT `AdminRolePermission_revokedByAdminUserId_fkey` FOREIGN KEY (`revokedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRbacAuditEvent` ADD CONSTRAINT `AdminRbacAuditEvent_actorAdminUserId_fkey` FOREIGN KEY (`actorAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRbacAuditEvent` ADD CONSTRAINT `AdminRbacAuditEvent_targetAdminUserId_fkey` FOREIGN KEY (`targetAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRbacAuditEvent` ADD CONSTRAINT `AdminRbacAuditEvent_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `AdminRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminRbacAuditEvent` ADD CONSTRAINT `AdminRbacAuditEvent_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `AdminPermission`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
