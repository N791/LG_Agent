-- CreateTable
CREATE TABLE "system_configs" (
    "key" VARCHAR NOT NULL,
    "value" TEXT NOT NULL,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("key")
);
