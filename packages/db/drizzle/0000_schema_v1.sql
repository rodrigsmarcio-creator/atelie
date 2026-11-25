CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`file_hash` text NOT NULL,
	`ran_at` text NOT NULL,
	`skills_inserted` integer DEFAULT 0 NOT NULL,
	`items_inserted` integer DEFAULT 0 NOT NULL,
	`grades_inserted` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`errors_json` text DEFAULT '[]' NOT NULL,
	CONSTRAINT "imports_kind_enum" CHECK(kind IN ('conteudo','notas_explicacao')),
	CONSTRAINT "imports_counts_min" CHECK(skills_inserted >= 0 AND items_inserted >= 0 AND grades_inserted >= 0 AND skipped >= 0),
	CONSTRAINT "imports_counts_by_kind" CHECK((kind = 'conteudo' AND grades_inserted = 0) OR (kind = 'notas_explicacao' AND skills_inserted = 0 AND items_inserted = 0)),
	CONSTRAINT "imports_errors_json_valid" CHECK(json_valid(errors_json))
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`path` text,
	`url` text,
	`body` text,
	`pages` integer,
	`progress` real DEFAULT 0 NOT NULL,
	`meta_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "materials_kind_enum" CHECK(kind IN ('pdf','video','link','nota','livro','markdown')),
	CONSTRAINT "materials_path_by_kind" CHECK((path IS NOT NULL) = (kind IN ('pdf','markdown'))),
	CONSTRAINT "materials_url_by_kind" CHECK((url IS NOT NULL) = (kind IN ('video','link'))),
	CONSTRAINT "materials_body_by_kind" CHECK(body IS NULL OR kind IN ('nota','markdown')),
	CONSTRAINT "materials_body_required_nota" CHECK(kind <> 'nota' OR body IS NOT NULL),
	CONSTRAINT "materials_pages_min" CHECK(pages IS NULL OR pages >= 1),
	CONSTRAINT "materials_progress_range" CHECK(progress BETWEEN 0 AND 1),
	CONSTRAINT "materials_meta_json_valid" CHECK(meta_json IS NULL OR json_valid(meta_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `materials_path_unique` ON `materials` (`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `materials_url_unique` ON `materials` (`url`);--> statement-breakpoint
CREATE TABLE `material_skills` (
	`material_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`page_from` integer,
	`page_to` integer,
	`created_at` text NOT NULL,
	PRIMARY KEY(`material_id`, `skill_id`),
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "material_skills_page_from_min" CHECK(page_from IS NULL OR page_from >= 1),
	CONSTRAINT "material_skills_page_to_min" CHECK(page_to IS NULL OR page_to >= 1),
	CONSTRAINT "material_skills_page_order" CHECK(page_from IS NULL OR page_to IS NULL OR page_from <= page_to)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`mode` text NOT NULL,
	`params_json` text NOT NULL,
	`state_hash` text NOT NULL,
	CONSTRAINT "plans_mode_enum" CHECK(mode IN ('completa','curta')),
	CONSTRAINT "plans_params_json_valid" CHECK(json_valid(params_json))
);
--> statement-breakpoint
CREATE TABLE `plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`block` integer NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`skill_id` text,
	`item_ids_json` text DEFAULT '[]' NOT NULL,
	`minutes` integer NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`reason_json` text NOT NULL,
	`breakdown_json` text,
	`scheduled_start` text,
	`google_event_id` text,
	`done_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "plan_items_block_range" CHECK(block BETWEEN 1 AND 4),
	CONSTRAINT "plan_items_kind_enum" CHECK(kind IN ('revisao_previa','materia_nova','reforco','cartoes')),
	CONSTRAINT "plan_items_kind_by_block" CHECK(kind = CASE block WHEN 1 THEN 'revisao_previa' WHEN 2 THEN 'materia_nova' WHEN 3 THEN 'reforco' WHEN 4 THEN 'cartoes' END),
	CONSTRAINT "plan_items_position_min" CHECK(position >= 0),
	CONSTRAINT "plan_items_minutes_min" CHECK(minutes >= 0),
	CONSTRAINT "plan_items_skipped_bool" CHECK(skipped IN (0,1)),
	CONSTRAINT "plan_items_skill_iff_not_skipped" CHECK((skill_id IS NULL) = (skipped = 1)),
	CONSTRAINT "plan_items_item_ids_json_valid" CHECK(json_valid(item_ids_json)),
	CONSTRAINT "plan_items_reason_json_valid" CHECK(json_valid(reason_json)),
	CONSTRAINT "plan_items_breakdown_json_valid" CHECK(breakdown_json IS NULL OR json_valid(breakdown_json))
);
--> statement-breakpoint
CREATE INDEX `plan_items_plan_scheduled_idx` ON `plan_items` (`plan_id`,`scheduled_start`);--> statement-breakpoint
CREATE UNIQUE INDEX `plan_items_plan_block_position` ON `plan_items` (`plan_id`,`block`,`position`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "settings_value_json_valid" CHECK(json_valid(value_json))
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`reference` text NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `programs_name_unique` ON `programs` (`name`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`program_id` text,
	`short_name` text,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`weight` integer DEFAULT 0 NOT NULL,
	`exam_at` text,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "subjects_color_hex" CHECK(length(color) = 7),
	CONSTRAINT "subjects_weight_range" CHECK(weight BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_name_unique` ON `subjects` (`name`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`name` text NOT NULL,
	`label` text,
	`description` text,
	`icon` text NOT NULL,
	`depth` integer NOT NULL,
	`lane` real DEFAULT 0 NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`origin` text NOT NULL,
	`reviewed_by_user` integer DEFAULT 0 NOT NULL,
	`source_material_id` text,
	`not_applicable_json` text DEFAULT '[]' NOT NULL,
	`study_explanation` text,
	`study_recommendations_json` text,
	`study_guidance` text,
	`study_faq_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "skills_depth_min" CHECK(depth >= 1),
	CONSTRAINT "skills_lane_range" CHECK(lane BETWEEN -1 AND 1),
	CONSTRAINT "skills_estimated_minutes_range" CHECK(estimated_minutes BETWEEN 10 AND 40),
	CONSTRAINT "skills_origin_enum" CHECK(origin IN ('manual','ia','import')),
	CONSTRAINT "skills_reviewed_by_user_bool" CHECK(reviewed_by_user IN (0,1)),
	CONSTRAINT "skills_not_applicable_json_valid" CHECK(json_valid(not_applicable_json)),
	CONSTRAINT "skills_study_recommendations_json_valid" CHECK(study_recommendations_json IS NULL OR json_valid(study_recommendations_json)),
	CONSTRAINT "skills_study_faq_json_valid" CHECK(study_faq_json IS NULL OR json_valid(study_faq_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_subject_name` ON `skills` (`subject_id`,`name`);--> statement-breakpoint
CREATE TABLE `skill_prereqs` (
	`skill_id` text NOT NULL,
	`prereq_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`skill_id`, `prereq_id`),
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prereq_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "skill_prereqs_not_self" CHECK(skill_id <> prereq_id)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`options_json` text,
	`answer` text NOT NULL,
	`explanation` text NOT NULL,
	`difficulty` integer,
	`dimension` text,
	`evidence` text,
	`category` text,
	`expected_seconds` integer,
	`followup` text,
	`rubric_json` text,
	`origin` text NOT NULL,
	`reviewed_by_user` integer DEFAULT 0 NOT NULL,
	`source_material_id` text,
	`source_page` integer,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "items_kind_enum" CHECK(kind IN ('multipla_escolha','cartao','aberta')),
	CONSTRAINT "items_options_json_shape" CHECK(options_json IS NULL OR (json_valid(options_json) AND json_array_length(options_json) = 4)),
	CONSTRAINT "items_options_json_by_kind" CHECK((kind = 'multipla_escolha' AND options_json IS NOT NULL) OR kind = 'cartao' OR (kind = 'aberta' AND options_json IS NULL)),
	CONSTRAINT "items_explanation_min" CHECK(length(explanation) >= 20),
	CONSTRAINT "items_difficulty_range" CHECK(difficulty IS NULL OR difficulty BETWEEN 1 AND 3),
	CONSTRAINT "items_dimension_enum" CHECK(dimension IS NULL OR dimension IN ('conceitual','fluencia','problemas','explicacao')),
	CONSTRAINT "items_dimension_not_cartao" CHECK(kind <> 'cartao' OR dimension IS NULL),
	CONSTRAINT "items_evidence_enum" CHECK(evidence IS NULL OR evidence IN ('reconhecimento','interpretacao','representacao','discriminacao')),
	CONSTRAINT "items_evidence_iff_conceitual" CHECK((evidence IS NOT NULL) = (COALESCE(dimension, '') = 'conceitual')),
	CONSTRAINT "items_interpretacao_only_me" CHECK(COALESCE(evidence, '') <> 'interpretacao' OR kind = 'multipla_escolha'),
	CONSTRAINT "items_category_enum" CHECK(category IS NULL OR category IN ('rotineira','nao_rotineira','transferencia')),
	CONSTRAINT "items_category_iff_problemas" CHECK((category IS NOT NULL) = (COALESCE(dimension, '') = 'problemas')),
	CONSTRAINT "items_expected_seconds_fluencia" CHECK(expected_seconds IS NULL OR (COALESCE(dimension, '') = 'fluencia' AND expected_seconds BETWEEN 1 AND 3600)),
	CONSTRAINT "items_followup_iff_explicacao" CHECK((followup IS NOT NULL) = (COALESCE(dimension, '') = 'explicacao')),
	CONSTRAINT "items_rubric_iff_explicacao" CHECK((rubric_json IS NOT NULL) = (COALESCE(dimension, '') = 'explicacao')),
	CONSTRAINT "items_rubric_json_valid" CHECK(rubric_json IS NULL OR json_valid(rubric_json)),
	CONSTRAINT "items_explicacao_only_aberta" CHECK(COALESCE(dimension, '') <> 'explicacao' OR kind = 'aberta'),
	CONSTRAINT "items_origin_enum" CHECK(origin IN ('manual','ia','import')),
	CONSTRAINT "items_reviewed_by_user_bool" CHECK(reviewed_by_user IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `items_skill_id_idx` ON `items` (`skill_id`);--> statement-breakpoint
CREATE TABLE `review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`mode` text NOT NULL,
	`correct` integer NOT NULL,
	`grade` integer,
	`answer_ms` integer NOT NULL,
	`viewed_solution` integer DEFAULT 0 NOT NULL,
	`reasoning` text,
	`response` text,
	`followup_answer` text,
	`attempt` integer,
	`round_id` text,
	`timed` integer DEFAULT 0 NOT NULL,
	`session_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "review_logs_mode_enum" CHECK(mode IN ('prova','retoque','sessao','simulado')),
	CONSTRAINT "review_logs_correct_bool" CHECK(correct IN (0,1)),
	CONSTRAINT "review_logs_grade_range" CHECK(grade IS NULL OR grade BETWEEN 1 AND 4),
	CONSTRAINT "review_logs_answer_ms_min" CHECK(answer_ms >= 0),
	CONSTRAINT "review_logs_viewed_solution_bool" CHECK(viewed_solution IN (0,1)),
	CONSTRAINT "review_logs_attempt_range" CHECK(attempt IS NULL OR attempt BETWEEN 1 AND 3),
	CONSTRAINT "review_logs_timed_bool" CHECK(timed IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `review_logs_item_reviewed_idx` ON `review_logs` (`item_id`,`reviewed_at`);--> statement-breakpoint
CREATE INDEX `review_logs_skill_reviewed_idx` ON `review_logs` (`skill_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `explanation_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`review_log_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`correcao` integer NOT NULL,
	`justificativa` integer NOT NULL,
	`coerencia` integer NOT NULL,
	`aplicacao` integer NOT NULL,
	`limitacoes` integer NOT NULL,
	`feedback` text,
	`graded_at` text NOT NULL,
	`import_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`review_log_id`) REFERENCES `review_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "explanation_grades_correcao_range" CHECK(correcao BETWEEN 0 AND 2),
	CONSTRAINT "explanation_grades_justificativa_range" CHECK(justificativa BETWEEN 0 AND 2),
	CONSTRAINT "explanation_grades_coerencia_range" CHECK(coerencia BETWEEN 0 AND 2),
	CONSTRAINT "explanation_grades_aplicacao_range" CHECK(aplicacao BETWEEN 0 AND 2),
	CONSTRAINT "explanation_grades_limitacoes_range" CHECK(limitacoes BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `explanation_grades_review_log_id_unique` ON `explanation_grades` (`review_log_id`);--> statement-breakpoint
CREATE TABLE `proofs` (
	`skill_id` text NOT NULL,
	`kind` text NOT NULL,
	`review_log_id` text NOT NULL,
	`earned_at` text NOT NULL,
	PRIMARY KEY(`skill_id`, `kind`),
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`review_log_id`) REFERENCES `review_logs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "proofs_kind_enum" CHECK(kind IN ('conceitual','fluencia','problemas','autonomia','explicacao'))
);
--> statement-breakpoint
CREATE TABLE `memory_states` (
	`item_id` text PRIMARY KEY NOT NULL,
	`due_at` text,
	`stability` real,
	`difficulty` real,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` integer DEFAULT 0 NOT NULL,
	`last_review_at` text,
	`algo_version` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "memory_states_state_enum" CHECK(state IN (0,1,2,3)),
	CONSTRAINT "memory_states_scheduled_days_min" CHECK(scheduled_days >= 0),
	CONSTRAINT "memory_states_learning_steps_min" CHECK(learning_steps >= 0),
	CONSTRAINT "memory_states_reps_min" CHECK(reps >= 0),
	CONSTRAINT "memory_states_lapses_min" CHECK(lapses >= 0)
);
--> statement-breakpoint
CREATE INDEX `memory_states_due_at_idx` ON `memory_states` (`due_at`);