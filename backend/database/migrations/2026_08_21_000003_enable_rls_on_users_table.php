<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared('ALTER TABLE users ENABLE ROW LEVEL SECURITY');
        DB::unprepared('ALTER TABLE users FORCE ROW LEVEL SECURITY');

        DB::unprepared("
            CREATE POLICY tenant_isolation ON users
            USING (
                tenant_id IS NULL
                OR tenant_id = current_tenant_id()
                OR current_tenant_id() IS NULL
            )
        ");
    }

    public function down(): void
    {
        DB::unprepared('DROP POLICY IF EXISTS tenant_isolation ON users');
        DB::unprepared('ALTER TABLE users NO FORCE ROW LEVEL SECURITY');
        DB::unprepared('ALTER TABLE users DISABLE ROW LEVEL SECURITY');
    }
};
