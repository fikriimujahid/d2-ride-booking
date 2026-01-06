import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetupMfaDto {
    @ApiProperty({ description: 'The access token from login', example: 'eyJ...' })
    @IsNotEmpty()
    @IsString()
    accessToken: string;
}
