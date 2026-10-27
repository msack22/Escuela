-- AlterTable
ALTER TABLE `discarded_posts` ADD COLUMN `scheduler_run_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `discarded_posts_scheduler_run_id_reason_idx` ON `discarded_posts`(`scheduler_run_id`, `reason`);

-- AddForeignKey
ALTER TABLE `discarded_posts` ADD CONSTRAINT `discarded_posts_scheduler_run_id_fkey` FOREIGN KEY (`scheduler_run_id`) REFERENCES `scheduler_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
