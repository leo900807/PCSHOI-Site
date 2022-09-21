import { MigrationInterface, QueryRunner } from "typeorm";

export class AdjustRegistrationDecimalPrecision1663749842375 implements MigrationInterface{

    public async up(queryRunner: QueryRunner): Promise<void>{
        await queryRunner.query(`ALTER TABLE registration MODIFY score DECIMAL(6,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void>{
        await queryRunner.query(`ALTER TABLE registration MODIFY score DECIMAL(5,2)`);
    }

}
