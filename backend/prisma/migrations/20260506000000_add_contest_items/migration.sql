CREATE TABLE `contest_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contest_id` INTEGER NOT NULL,
    `subject_id` INTEGER NOT NULL,
    `hours_to_cover` INTEGER NULL,
    `item_type` VARCHAR(20) NOT NULL DEFAULT 'materia',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `contest_items_contest_id_idx` (`contest_id`),
    INDEX `contest_items_subject_id_idx` (`subject_id`),
    CONSTRAINT `contest_items_contest_id_fkey` FOREIGN KEY (`contest_id`) REFERENCES `contests` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `contest_items_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
