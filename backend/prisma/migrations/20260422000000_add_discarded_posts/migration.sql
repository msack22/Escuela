CREATE TABLE `discarded_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `source_name` VARCHAR(255) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `reason` VARCHAR(100) NOT NULL,
    `keyword_matched` VARCHAR(100) NULL,
    `post_date` DATETIME(3) NULL,
    `discarded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
