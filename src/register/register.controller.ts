import { Controller, Post, ValidationPipe, Body ,Get, Param, Delete} from '@nestjs/common';
import { RegisterService } from './register.service';
import { username } from 'src/required/dto/username.dto';
import {publickey} from '../required/dto/publickey.dto'
import { ApiBody, ApiCreatedResponse,  ApiNotFoundResponse,ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { reset } from 'src/required/dto/reset.dto';
import { detailOfCard} from '../../gameblock'
import { string } from '@hapi/joi';
// import {public_key_dto} from './register.interface'
@Controller('register')
export class RegisterController {

    constructor(private readonly registerService:RegisterService){}

    @Post('/mycard')
    @ApiOkResponse({description: 'Returns available card'})
    @ApiBody({type:publickey})
    mycard(@Body() publickey:publickey){
      console.log("I was hit")
      console.log(publickey)
      return this.registerService.getUserCardDetails(publickey);
    }


    @Get('/createWallet')
    @ApiOkResponse({description: 'Wallet Created with zero ether'})
    createWallet(){
      return this.registerService.createWallet();
    }

// Create user for 
    @Post('/createUser')
    @ApiBody({type: username})
    @ApiCreatedResponse({description: "An object with response with response in res key."})
    createUser(@Body() userNameDto:username){
      return this.registerService.createUser(userNameDto)
  
    }

    // Create user for 
    @Post('/createcard')
    @ApiBody({type: username})
    @ApiCreatedResponse({description: "An object with response with response in res key."})
    createCard(@Body() userNameDto:username){
      return this.registerService.addData(userNameDto.publickey);
  
    }




    @Post('/:forgotUser')
    @ApiCreatedResponse({description : 'user email id is staged for resetting the password'})
    resetPass(@Param('forgotUser') email:string){
      console.log(email);
      return this.registerService.resetPass(email)
    }

    @Get('/:show')
    @ApiOkResponse({description: 'stars and cards assigned for first time signup'})
    showStar(@Param('show') account:string){
      return this.registerService.show(account);
    }

    @Delete('/:reset')
    @ApiOkResponse({description : 'resetting of the password is done'})
    @ApiBody({type:reset})
    reset(@Body() reset:reset){
      console.log(reset); 
      return this.registerService.reset(reset);
    
    }

    @Get('/test')
    async getcards(){
         const data = await detailOfCard(392);
         console.log(data+"   "+data[0]+"   "+data[1]);
    }


  }

