import { number } from "@hapi/joi"
import { ApiProperty } from "@nestjs/swagger"
import { IsEmail, IsNotEmpty } from "class-validator"

export class itemtoBeBidDTO{
    
    @IsNotEmpty()
    @ApiProperty({type: String , description: "username"})
    username:string

    
    @IsNotEmpty()
    @ApiProperty({type: Number , description: "Id of card"})

    cardid:number
    
    @IsNotEmpty()
    @ApiProperty({type: Number , description: "bid price"})

    price:number
  
  }