-- CreateTable
CREATE TABLE "client_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "level" VARCHAR NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" VARCHAR,
    "user_agent" VARCHAR,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_metrics" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" VARCHAR,
    "path" VARCHAR,
    "user_agent" VARCHAR,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_metrics_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "client_logs" ADD CONSTRAINT "client_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_metrics" ADD CONSTRAINT "client_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
