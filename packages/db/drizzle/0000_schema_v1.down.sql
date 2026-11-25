-- Reversão da 0000_schema_v1, escrita à mão (D-064): o drizzle-kit só gera o
-- up. Apaga as tabelas na ordem inversa das FKs (filha antes da mãe), então
-- funciona com PRAGMA foreign_keys = ON. Os índices caem com as tabelas.
-- Por ser a primeira migration, apaga também o registro do migrator, e o banco
-- volta a ficar vazio. O drizzle ignora este arquivo: ele não está no
-- meta/_journal.json. Quem roda é o teste do ATL-72 (executeMultiple).
DROP TABLE `proofs`;
DROP TABLE `memory_states`;
DROP TABLE `explanation_grades`;
DROP TABLE `review_logs`;
DROP TABLE `plan_items`;
DROP TABLE `plans`;
DROP TABLE `material_skills`;
DROP TABLE `skill_prereqs`;
DROP TABLE `items`;
DROP TABLE `skills`;
DROP TABLE `subjects`;
DROP TABLE `programs`;
DROP TABLE `materials`;
DROP TABLE `imports`;
DROP TABLE `settings`;
DROP TABLE IF EXISTS `__drizzle_migrations`;
