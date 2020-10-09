import { ConflictException, HttpCode, Injectable} from '@nestjs/common';
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

                const legitkey=await this.EmailVerify.findOne().where('name').equals(reset.name).select('key');

                if(legitkey.key==reset.key)

                {

                  const user= await this.user.findOne().where('username').equals(reset.name).exec();


                  user.salt = await bcrypt.genSalt();

                  user.password = await this.hashPassword(reset.newPass,user.salt);

                  user.save()

                  console.log("password updated successfully")

                  this.EmailVerify.deleteMany({name:reset.name}, function (err) {

                    
      
                    if(err) console.log(err);
      
                    console.log("Successful deleted from passkey db also");})
      
                    return "password updated successfully"
  
                  }
  
                  else
  
                  {
  
                    console.log("key not matched")
  
                    return "key not match"
  
                  }

                }


                async resetPass(name:string)

                {

                  this.EmailVerify.deleteMany({name:name}, function (err) 

                  {

                    if(err) console.log(err);

                    console.log("Successful deletion of previous records with same name before password reset");

                  })

                  let existence = await this.user.collection.findOne({ username: name})


                  if(existence){

                    const matchkey=(Math.floor((Math.random() * 10000) + 54))

                    const pass = new this.EmailVerify({

                      name:name,

                      key:matchkey

                    })

                    pass.save()

                    this.notificationService.sendEmail(name,matchkey)

                  }

                  else

                  {

                    console.log(`User with ${name} not exist`)

                  }


                }


                private async hashPassword(password:string,salt:string):Promise<string>{

                  return bcrypt.hash(password,salt);

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

					user.role = 'PLAYER';



				try

				{


				console.log(user)

				const userinDBwithThisEmail =  await this.user.collection.findOne({ email: userNameDto.email}) 

				if(userinDBwithThisEmail){
					return new ConflictException('Email Already Exist');
				}

				const userinDBwithThisPublicKey = await this.user.collection.findOne({ publickey: userNameDto.publickey}) 
				if(userinDBwithThisPublicKey){
					return new ConflictException('Public Key Already in use');
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
				return `user exists with provided name you can try from these three ${arr}`;

				} 
				}
				catch(err){
				console.log(err);
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
						
						console.log(user.cards)
						
						user.stars = 10

						user.publickey = userNameDto.publickey
						user.userinBlockchain = true;

						await user.save();

						return "SignUp Successfull account successfully created starter benefits also credited";
					
					}
					
					else
					
					{
					
						return "not created"
					
					}


					}

					catch(Error){

					//console.error(Error);

					return `User not created + ${Error}`;

					}




				} 


				catch (err) 


				{


				console.error(err)


				}


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
		}
