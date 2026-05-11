CREATE TABLE `scheduler_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `started_at` DATETIME(3) NOT NULL,
    `finished_at` DATETIME(3) NOT NULL,
    `timezone` VARCHAR(50) NOT NULL,
    `hour_ar` INTEGER NOT NULL,
    `sources` VARCHAR(255) NOT NULL,
    `total_contests` INTEGER NOT NULL DEFAULT 0,
    `cge_count` INTEGER NOT NULL DEFAULT 0,
    `facebook_count` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
