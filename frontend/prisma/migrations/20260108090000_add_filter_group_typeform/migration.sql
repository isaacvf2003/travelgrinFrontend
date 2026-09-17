-- Add typeForm to filter_groups
ALTER TABLE "filter_groups" ADD COLUMN "typeForm" TEXT NOT NULL DEFAULT 'default';
