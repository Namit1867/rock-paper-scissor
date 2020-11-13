import { BadRequestException, ConflictException, Injectable, Post, UnauthorizedException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { user } from 'src/required/interfaces/user.interface';
import { username } from 'src/required/dto/username.dto';
import { NotificationService } from 'src/notification/notification.service';
import { EmailVerify } from 'src/required/interfaces/EmailVerify.interface';
import * as bcrypt from 'bcrypt'
import { sign_up, show_stars, total_cards ,returnownedTokens } from '../../gameblock';
import { CreateAccount } from '../../pampweb';
import { reset } from 'src/required/dto/reset.dto';
import { ConfigService } from '@nestjs/config';
import { exists } from 'fs';
import { public_key_dto } from './register.interface';
@Injectable()
export class RegisterService
 {
  constructor(
              @InjectModel('user')  private readonly user:Model<user>,
   
              @InjectModel('EmailVerify') private readonly EmailVerify:Model<EmailVerify>,
   
              private readonly notificationService:NotificationService,
              private configueservice : ConfigService ){}
  
              private obj_deployed_addresses = {
              gameContractAddress : this.configueservice.get<string>('gameContractAddress'),
              nftContractAddress : this.configueservice.get<string>('nftContractAddress'),
              starsContractAddress : this.configueservice.get<string>('starsContractAddress'),
              }
              


              async reset(reset:reset)

              {
				//   console.log(reset)
				const resetPassword = await this.EmailVerify.findOne({key:reset.key})
                if (!resetPassword){ 
					return new BadRequestException('Invalid reset password request')
				}
				

				const user = await this.EmailVerify.findOne({email:reset.email})
				if (!user) {
					return new BadRequestException('User does not exist')
				}
				
				const legitkey=await this.EmailVerify.findOne().where('email').equals(reset.email).select('key');

                if(legitkey.key==reset.key)

                {

                  const user= await this.user.findOne().where('email').equals(reset.email).exec();


                  user.salt = await bcrypt.genSalt();

                  user.password = await this.hashPassword(reset.newPass,user.salt);

                  await user.save()

                  console.log("password updated successfully")

                  this.EmailVerify.deleteMany({email:reset.email}, function (err) {

                    
      
                    if(err) console.log(err);
      
                    console.log("Successful deleted from emailverify db also");})
      
                    return "password updated successfully"
  
                  }
  
                  else

                  {
  
                    console.log("Password not updated")
  
                    return "key not match"
  
                  }

				
              }


                async resetPass(email:string)

                {

                  this.EmailVerify.deleteMany({email:email}, function (err) 

                  {

                    if(err) console.log(err);

                    console.log("Successful deletion of previous records with same email before password reset");

                  })

                  let existence = await this.user.collection.findOne({ email: email})


                  if(existence){

                    const matchkey=(Math.floor((Math.random() * 10000) + 54))

                    const pass = new this.EmailVerify({

                      email:email,

                      key:matchkey

                    })

                    await pass.save()

                    this.notificationService.sendEmail(email,matchkey)

                  }

                  else

                  {
					return  new UnauthorizedException("invalid_email")

					

                  }


                }


                private async hashPassword(password:string,salt:string):Promise<string>{

                  return bcrypt.hash(password,salt);

                }


                async addData(publickey:string){
				  const user = await this.user.findOne({publickey:publickey});
				  let arrofCards = await returnownedTokens(publickey);
				  //console.log(<Int32Array>arrofCards)
				  for(var i = 9 ; i <= 35 ; i++)
				  user.notUsedCards.push(arrofCards[i])

				  await user.save();
				}


   
                // Create User Service starts here

				async createUser(userNameDto:username)

				{
					const user=new this.user()
					user.username=userNameDto.username,
					user.email=userNameDto.email,
					user.cards={ ROCK:[],PAPER:[],SCISSOR:[]},
					user.usedCards=[],
					user.notUsedCards=[],
					user.stars=0,
					user.userinBlockchain=false,
					user.lastupdated=new Date(),
					user.salt=await bcrypt.genSalt(),
					user.password=await this.hashPassword(userNameDto.password,user.salt)
					user.role = 'PLAYER'

				try

				{


				console.log(user)
				const userinDBwithThisEmail =  await this.user.collection.findOne({ email: userNameDto.email}) 
				if(userinDBwithThisEmail){
					return new BadRequestException('Email Already Exist');
				}
				const userinDBwithThisPublicKey = await this.user.collection.findOne({ publickey: userNameDto.publickey}) 
				if(userinDBwithThisPublicKey){
					return new BadRequestException('Public key already in use');
				}
				
				const userinDBwithThisName = await this.user.collection.findOne({ username: userNameDto.username})
				if(userinDBwithThisName)
				{
					const arr=[]

					console.log("user with provided credentials already exist ");
					var i=0

					while(i<3)

					{

					const user1 = userNameDto.username+Math.floor((Math.random() * 100) + 54)

					const userfind=await user.collection.findOne({ username: user1})

					if(userfind)

					{}

					else

					{

						arr.push(user1)

						i++

					}

					}
					return new BadRequestException(  {
						"message":"This username is taken",
						"available_username":arr});

				} 
				}
				catch(error){
					console.log(error.code)
				console.log(error);
				}

				// else{

				try{

						await user.save();

						let flag = 0;

						const secondFunction = async () => 
						{
						const result = await sign_up(userNameDto.publickey,this.obj_deployed_addresses.gameContractAddress)
						if(result === 1)
						flag=1
						
						}
					
					try{
						await secondFunction()
					}
					catch(err){
					
						flag=0;
					    return new BadRequestException("Account has been created successfuly but error occured in blockchain network due to invalid public key. Please login and update public key to get started.")
					}

					if(flag == 1)
					
					{
						let arrofCards = await returnownedTokens(userNameDto.publickey)

						console.log(<Int32Array>arrofCards)

						for(var i = 0 ; i < 3 ; i++)
						user.cards.ROCK.push(arrofCards[i])

						for(var i = 3 ; i < 6 ; i++)
						user.cards.PAPER.push(arrofCards[i])
						
						for(var i = 6 ; i < 9 ; i++)
						user.cards.SCISSOR.push(arrofCards[i])

						for(var i = 0 ; i < 9 ; i++)
						user.notUsedCards.push(arrofCards[i])

						user.stars = 10
						user.publickey = userNameDto.publickey
						user.userinBlockchain = true;

						await user.save();

						return{
							 message:"Signup Successful"
						}
					}
					
					else
					
					{
						return{message: {"message":"Your account has been created but there was error while transfering starter pack. Please login and update your public key to get started. "}}
					
					}
					}

					catch(Error){

					return { message:`${Error.message}`};

					}

				} 


				catch (err) 


				{
				console.error(err)}

                
              	async show(account:string){
                var obj: { stars: string; cards: string; };
                const star = await show_stars(account);
                const cards = await total_cards(account);
				obj = {"stars": `${star}`,"cards": `${cards}`};
				return obj;
              }
			
				async createWallet(){
					return CreateAccount();
				}



				async getUserCardDetails(publickey){
   
					console.log(publickey.publickey)
					var data =  publickey.publickey;
		     var Public_key= await this.user.find({'publickey':data})

				if(Public_key.length > 0){
					return returnownedTokens(data)
				}
				else{
					return "Public key not found"
				}
				}

		}



