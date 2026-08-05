ALTER TABLE "component" RENAME TO "service";--> statement-breakpoint
ALTER TABLE "incident_component" RENAME TO "incident_service";--> statement-breakpoint
ALTER TABLE "check_result" RENAME COLUMN "component_id" TO "service_id";--> statement-breakpoint
ALTER TABLE "incident_service" RENAME COLUMN "component_id" TO "service_id";--> statement-breakpoint
ALTER INDEX "check_result_component_checked_idx" RENAME TO "check_result_service_checked_idx";--> statement-breakpoint
ALTER TABLE "check_result" RENAME CONSTRAINT "check_result_component_id_component_id_fk" TO "check_result_service_id_service_id_fk";--> statement-breakpoint
ALTER TABLE "service" RENAME CONSTRAINT "component_status_page_id_status_page_id_fk" TO "service_status_page_id_status_page_id_fk";--> statement-breakpoint
ALTER TABLE "incident_service" RENAME CONSTRAINT "incident_component_incident_id_incident_id_fk" TO "incident_service_incident_id_incident_id_fk";--> statement-breakpoint
ALTER TABLE "incident_service" RENAME CONSTRAINT "incident_component_component_id_component_id_fk" TO "incident_service_service_id_service_id_fk";--> statement-breakpoint
ALTER TABLE "incident_service" RENAME CONSTRAINT "incident_component_incident_id_component_id_pk" TO "incident_service_incident_id_service_id_pk";
