DO $migration$
BEGIN
IF to_regclass('public.system_configs') IS NULL THEN

-- CreateTable
CREATE TABLE "system_configs" (
    "key" VARCHAR NOT NULL,
    "value" TEXT NOT NULL,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);

END IF;
END;
$migration$;
