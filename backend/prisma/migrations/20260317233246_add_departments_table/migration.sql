-- CreateTable
CREATE TABLE `schools` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `department` VARCHAR(100) NOT NULL,
    `department_id` INTEGER NULL,
    `address` TEXT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `school_type` VARCHAR(100) NULL,
    `school_number` VARCHAR(50) NULL,
    `principal_name` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `subjects_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `date` DATETIME(0) NOT NULL,
    `registration_deadline` DATETIME(0) NULL,
    `publication_date` DATETIME(0) NULL,
    `level` VARCHAR(50) NULL,
    `shift` VARCHAR(50) NULL,
    `schedule` TEXT NULL,
    `hours_to_cover` INTEGER NULL,
    `contract_type` VARCHAR(100) NULL,
    `school_id` INTEGER NOT NULL,
    `subject_id` INTEGER NOT NULL,
    `source_url` VARCHAR(1000) NOT NULL,
    `source_name` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_processed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_admin` BOOLEAN NOT NULL DEFAULT false,
    `notification_days_ahead` INTEGER NOT NULL DEFAULT 3,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alerts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `user_name` VARCHAR(255) NOT NULL,
    `whatsapp_number` VARCHAR(20) NOT NULL DEFAULT '',
    `email_address` VARCHAR(255) NULL,
    `subject_preferences` TEXT NULL,
    `max_distance_km` INTEGER NOT NULL DEFAULT 50,
    `notification_channels` VARCHAR(50) NOT NULL DEFAULT 'both',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `contest_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contest_notification_sent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alert_id` INTEGER NOT NULL,
    `contest_id` INTEGER NOT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(50) NOT NULL DEFAULT 'sent',
    `error_message` TEXT NULL,

    UNIQUE INDEX `contest_notification_sent_alert_id_contest_id_key`(`alert_id`, `contest_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    UNIQUE INDEX `departments_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scraping_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_name` VARCHAR(255) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `contests_found` INTEGER NOT NULL DEFAULT 0,
    `contests_processed` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `execution_time_seconds` DOUBLE NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `schools` ADD CONSTRAINT `schools_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contests` ADD CONSTRAINT `contests_school_id_fkey` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contests` ADD CONSTRAINT `contests_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_contest_id_fkey` FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contest_notification_sent` ADD CONSTRAINT `contest_notification_sent_alert_id_fkey` FOREIGN KEY (`alert_id`) REFERENCES `alerts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contest_notification_sent` ADD CONSTRAINT `contest_notification_sent_contest_id_fkey` FOREIGN KEY (`contest_id`) REFERENCES `contests`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
