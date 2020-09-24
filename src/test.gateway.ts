import { SubscribeMessage, OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect, WebSocketServer, WebSocketGateway ,} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import {v4 as uuid} from 'uuid'
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { user } from './required/interfaces/user.interface';
import {CardStatus} from './required/cards.enum'
import { passkey } from './required/interfaces/passkey.interface';
import { PlayService } from './play/play.service';
import {jwtStrategy} from './jwt.strategy'
import * as jwt from 'jsonwebtoken'
import {JwtPayLoad} from './required/interfaces/jwt-payload.interface'
import { detailOfCard} from '.././gameblock'
import { ConfigService } from '@nestjs/config';
import { AppGateway } from './app.gateway'
import { NotificationService } from './notification/notification.service';

@WebSocketGateway({namespace:'/game'})
export class TestGateway implements OnGatewayInit, OnGatewayConnection , OnGatewayDisconnect{
  
 
  constructor(
               private  general:AppGateway,
              
              private jwtstrategy:jwtStrategy,
              
              @InjectModel('user')  private readonly user:Model<user>,
              
              @InjectModel('passkey') private readonly passkey:Model<passkey>,
              
			  private readonly playservice:PlayService,
			  
			  private configservice: ConfigService,
			  
			  private NotificationService:NotificationService ){}

  private logger:Logger = new Logger('TestGateway');

  private check = {}//check whether a client is authorized or not
  
  private currConnected={};//client connected to any room or game currently true or false
  
  //private noOfusers = 1 //to count no of users in game room
  
  private emailOfConnectedUser: String;//email of users fetched from db using their given accesstoken
  
  private nameOfConnectedUser: String;//name of users fetched from db using their given accesstoken

  private roleOfConnectedUser: String;
  
//   private gameCollection={} //{gameid:{userarray:[],timestamp,typeOfGame,status,Moves,RoomName}}
  
  //private clientAndUser = {}             //{client.id:this.emailofconnecteduser}
  
  private users = {}     // client id:game id

  private custom_id = {}; // client.id : custome_id by uuid()

  private user_timestamp = {};  //client
 
  private room_status = {} //room.id : true if game has been started in that room

  private games = [] // gameid and other user details

  public room_invite_flag = {} //room id and status if there is a pending invitition

  public room_invited_player_email = {} //room id and email of the player who is invited

  private adminBlockStars = {} //client id with no of blocked stars by admin

  private clientidwithName = {} //clientid with associated names
    
//   private noOfusers = 1 //to count no of users connected
  
//   private gameCollection={} //{gameid:{userarray:[],timestamp,typeOfGame,status,Moves,RoomName}}
  
//   private clientAndUser={}             //{client.id:this.emailofconnecteduser}

//   private user_check = {} //client.id : true if user is in a room false if user has left the room

  
  @WebSocketServer() wss:Server;
  
async  afterInit(server: Server) {

    this.logger.log(`initialised`);
  
  }


  async handleConnection(client:Socket) {

	console.log("i also")

		client.on('hand',async (data) => {
	
		    console.log('I ran');

			const ans = <JwtPayLoad>jwt.verify(data,this.configservice.get<string>('JWT_SECRET'))

			this.emailOfConnectedUser = ans.email
		
			this.nameOfConnectedUser = ans.username
			
			this.roleOfConnectedUser = ans.role

			let isuserValidatedwithPlayload = await this.jwtstrategy.validate(ans)

			if(isuserValidatedwithPlayload) {
				client.emit('return',isuserValidatedwithPlayload) //in the browser console this output will be showm
			}

			else{
				client.emit('return',"client not verified with this payload")

				this.emailOfConnectedUser = null;
		
				this.nameOfConnectedUser = null;
				
				this.roleOfConnectedUser = null;

				client.disconnect();
			}
	
		})
	
		client.emit('welcome',"welcome to the server")
	
		// this.clientAndUser[client.id] = this.emailOfConnectedUser;

		if(this.emailOfConnectedUser){

			this.clientidwithName[client.id] = this.nameOfConnectedUser

			this.check[client.id] = true; //check that user has verified there payload
		
		}
		else{

			client.emit('ERROR','NO PAYLOAD TO VERIFY');
			
		    this.handleDisconnect(client)
		}

/*----------------------for long duration game when user leaves room for some time and rejoin it we have to see is there any pending game with that user inside it --------------------------------*/
	
            if(await this.passkey.findOne().where('user1').equals(this.nameOfConnectedUser)){

			const game = await this.passkey.findOne().where('user1').equals(this.nameOfConnectedUser).exec();
			const user1 = await this.user.findOne().where('username').equals(this.nameOfConnectedUser).exec();
			game.client1id = client.id
			await game.save();
			await user1.save();
			this.handleJoin(client,game.gameid);
		}
		else if(await this.passkey.findOne().where('user2').equals(this.nameOfConnectedUser)){
			const game = await this.passkey.findOne().where('user2').equals(this.nameOfConnectedUser).exec();
			const user2 = await this.user.findOne().where('username').equals(this.nameOfConnectedUser).exec();
			game.client2id = client.id
			await game.save();
			await user2.save();
			this.handleJoin(client,game.gameid);
		}
		/*------------------------------------------------------*/

		/*------logic for checking the invitation email------*/

		if( this.check[client.id] && Object.values(this.room_invited_player_email).indexOf(this.emailOfConnectedUser) != -1){

			const userdata = await this.user.findOne().where('username').equals(this.nameOfConnectedUser).exec();

			// transfer stars from user to admin account and keep track of it

			let noOfStarsHolding = userdata.stars;
            
			if(noOfStarsHolding>3){

				userdata.stars = noOfStarsHolding-3;
				this.adminBlockStars[client.id] = 3
			
			}
			else if(noOfStarsHolding>0 && noOfStarsHolding<=3)
			{
			userdata.stars = 0;
			this.adminBlockStars[client.id] = noOfStarsHolding
			}
			else{
				client.emit('no stars','you have zero stars')

				this.emailOfConnectedUser=null
	
		     	this.nameOfConnectedUser=null

		    	this.roleOfConnectedUser =null

				client.disconnect();
			}
		
			userdata.save();

			this.handleJoinInvitation(client,Object.keys(this.room_invited_player_email)[Object.values(this.room_invited_player_email).indexOf(this.emailOfConnectedUser)]);
	
			this.emailOfConnectedUser=null
	
			this.nameOfConnectedUser=null

			this.roleOfConnectedUser =null
	
			// client.emit('joined', `welcome user ${client.id}`);

		
		}
		/*---------------------------------------------------*/

		else if(this.check[client.id]){

			//  this.currConnected[client.id] = true;
	
			const userdata = await this.user.findOne().where('username').equals(this.nameOfConnectedUser).exec();
		

			let noOfStarsHolding = userdata.stars;

			if(noOfStarsHolding>3){

				userdata.stars = noOfStarsHolding-3;
				this.adminBlockStars[client.id] = 3
			}
			else if(noOfStarsHolding>0 && noOfStarsHolding<=3)
			{
			userdata.stars = 0;
			this.adminBlockStars[client.id] = noOfStarsHolding
			}
			else{
				client.emit('no stars','you have zero stars')

				this.emailOfConnectedUser=null
	
		     	this.nameOfConnectedUser=null

		    	this.roleOfConnectedUser =null

				client.disconnect();
			}
		
		
			userdata.save();
	
			this.emailOfConnectedUser = null;
	
			this.nameOfConnectedUser = null;

			this.roleOfConnectedUser = null;
	
			client.emit('joined', `welcome user ${client.id}`);
		}
  }

  	@SubscribeMessage('Join_Alone')
	handleJoin_Alone(client: Socket){
		if(this.check[client.id]){

			const pos = this.games.findIndex((game) => { return game.players == 1 || game.players == 0});

			if(pos != -1 && (this.room_status[this.games[pos].gameRoom] != true) && this.room_invite_flag[this.games[pos].gameRoom] != true){


				this.room_status[this.games[pos].gameRoom] = true
				// const game_pos = this.games.findIndex((game) => { return game.gameRoom == this.games[pos].gameRoom});
		
				// this.games[game_pos].users.push(client.id);
		
				this.user_timestamp[client.id] = Date.now();
		
				this.handleJoin( client, this.games[pos].gameRoom);
		
				this.games[pos].players++;

				this.handleJoin( client, this.games[pos].gameRoom);
		
				// this.user_check[client.id] = `true`;

			}

			else {
				client.emit('NOTICE','No room is free now wait for someone to join')
				this.handlejoinFirstTime(client);
				this.user_timestamp[client.id] = Date.now();
			}
		}

		else {
			client.emit('Error','Unverified payload');
			client.disconnect();
		}
	}

	@SubscribeMessage('Join_With_Friend')
	handleJoin_with_Friend(client: Socket) {
		if(this.check[client.id]){
			this.handlejoinFirstTime(client);
			const room = this.users[client.id];
			this.room_invite_flag[room] = true;
		}
		else{
			client.emit("Error","Unverified payload");
			client.disconnect();
		}
	}


  handleJoinInvitation(client: Socket,room: string) {

	const pos  =  this.games.findIndex((game) => game.gameRoom == room);
	client.join(room);
	client.emit('Joined',`Welcome to the room ${room}`);
	client.to(room).broadcast.emit('user joined', `User ${client.id} has joined the room`);

	this.currConnected[client.id] = true;
	this.users[client.id] = room;
	this.custom_id[client.id] = uuid();
	this.user_timestamp[client.id] = Date.now();
	this.room_status[this.games[pos].gameRoom] = true
	this.games[pos].players++;		
	
	// this.user_check[client.id] = 'true';
	delete this.room_invited_player_email[room];

  }
  
  handlejoinFirstTime(client:Socket){
		if(this.check[client.id])
	
		{
	
			let gameId = uuid();
		
			this.games.push({
		
					gameRoom: `${gameId}`,
			
					players: 1
		
			})
		
			client.join(gameId)

			this.currConnected[client.id] = true

			this.users[client.id]=gameId

			this.custom_id[client.id] = uuid();

			this.user_timestamp[client.id] = Date.now()

			this.room_invite_flag[gameId] = false;
		
			client.emit('joinedGame',`welcome to ${gameId}`)        
	
		}
  
	}

  

  
  handleJoin(client:Socket , game: string):void{
  
    client.join(game)
  
	client.emit('joinedRoom',`welcome to ${game}`);
	
	client.to(game).broadcast.emit('joinedRoom',`${client.id} has joined the Game`);
	
	this.currConnected[client.id] = true
  
    this.users[client.id] = game;
  
	this.custom_id[client.id] = uuid();
	
	this.user_timestamp[client.id] = Date.now();
  
  }

  
  	handleDisconnect(client: Socket):void {

		console.log("it happen succesfully")
		if(this.currConnected[client.id]){
			const room = this.users[client.id];
			this.wss.to(room).emit('disconnect',`${client.id} disconnected`);
		}
		this.logger.log(`${client.id} disconnected`);
	}

  @SubscribeMessage('chat')
  handlechat(client: Socket, data: string):void {
   
	if(this.check[client.id]) {
		const room = this.users[client.id];
		this.wss.to(room).emit('chat', data);
	}
	else client.disconnect();
  
 }
  

  


 
		@SubscribeMessage('invite')
		handleinvite(client: Socket,email:string){

			const room = this.users[client.id];
			const pos  =  this.games.findIndex((game) => game.gameRoom == room);
			if(this.games[pos].players<2){
				// this.room_invite_flag[room] = true;
				this.room_invited_player_email[room] = email;
				client.emit("Success",`Invitation sent to ${email}`);
				this.NotificationService.send_room_code(email);
			}
			else{
				client.emit('Error','Room full');
			}
			
			//this.games.findIndex((game) => { return game.players == 1 || game.players == 0});
			
		}

		// @SubscribeMessage('cancel_invite')
		// handleCancel(client:Socket){
		// 	const room = this.users[client.id];
		// 	// const pos  =  this.games.findIndex((game) => game.gameRoom == room);
		// 	delete this.room_invited_player_email[room];
		// 	client.emit("Success","Invitation has been canceled");
		// }

		// @SubscribeMessage('free_room')
		// handlefreeroom(client:Socket){
		// 	const room = this.users[client.id];
		// 	if(this.room_invite_flag[room]){
		// 		// const pos  =  this.games.findIndex((game) => game.gameRoom == room);
		// 		client.emit("Success","anyone can join now")
		// 		this.room_invite_flag[room] = false;
		// 	}

		// 	else{
		// 		client.emit("Warning","Cancle the invite first");
		// 	}
		// }

		
		@SubscribeMessage('End_Game')
		async handleEndGame(client:Socket) {
			const _room = this.users[client.id];
			const pos  =  this.games.findIndex((game) => game.gameRoom == _room);
		  	if(this.currConnected[client.id]){


				//DB access

				const game = await this.passkey.findOne().where('gameid').equals(_room).exec();

				const user_1 =  await this.user.findOne().where('publickey').equals(game.player1address).exec();

				const user_2 = await this.user.findOne().where('publickey').equals(game.player2address).exec();

				user_1.stars += this.adminBlockStars[game.client1id];
				
				user_2.stars += this.adminBlockStars[game.client2id];

				
				delete this.adminBlockStars[game.client1id];
				delete this.adminBlockStars[game.client2id];

				await user_1.save();
				await user_2.save();
				await game.deleteOne();


				client.leave(_room);
				delete this.users[client.id];
				delete this.user_timestamp[client.id];
				delete this.games[pos]
				delete this.room_invite_flag[_room];
				this.currConnected[client.id] = false;
				this.room_status[_room] = false
				client.to(_room).broadcast.emit('End_Game', `${client.id} has ended the Game`);
				

				//client_2 changes

				const _pos = Object.values(this.users).indexOf(_room);

				const client_2_id = Object.keys(this.users)[_pos];

				this.currConnected[client_2_id] = false;

				//Blockchain part for star transefer from admin

				client.disconnect();
				
		  	}
		 	else{
				client.emit('Error',`Enter to a game`);
		  	}
		}



		@SubscribeMessage('leaveRoom')
		async handleLeaveRoom(client:Socket){
			const room = this.users[client.id];
			const pos  =  this.games.findIndex((game) => game.gameRoom == room);
			if(await this.passkey.findOne().where('gameid').equals(room).exec()){
				client.emit('Error','Game has not ended yet');
			}else {
				client.leave(room);
				delete this.users[client.id];
				delete this.user_timestamp[client.id];
				delete this.adminBlockStars[client.id];
				this.currConnected[client.id] = false;
				this.games[pos].players--;
				client.to(room).broadcast.emit('Left',`${client.id} has left the room`);
			}
		}

		// @SubscribeMessage('End_Game')
		// handleEndGame(client: Socket){
		// 	const room = this.users[client.id];
		// 	this.handleLeave(client,room);
		// 	client.disconnect();
		// 	client.to(room).broadcast.emit('End_Game', `${client.id} has ended the Game`);
		// }


		@SubscribeMessage('show')
		handleshow(): void {
			console.log(`--------------------------------------------`)
			console.log(`client.id : room.id`);
			console.log(this.users);
			console.log(`client.id : timestamp`);
			console.log(this.user_timestamp);
			console.log(`client.id : custom id using uuid()`);
			console.log(this.custom_id);
			console.log(` room_id : Game status in the room`);
			console.log(this.room_status);
			console.log('games');
			console.log(this.games);
			console.log("client.id : check weather they are currently in a room or not")
			console.log(this.currConnected);
			console.log("check");
			console.log(this.check);
			console.log("roomid:invited email")
			console.log(this.room_invited_player_email);
			console.log("room id : true if there is a pending invitation")
			console.log(this.room_invite_flag)
			console.log("client_id : no.of blockstars")
			console.log(this.adminBlockStars)
			console.log(`--------------------------------------------`)
			// console.log(`client.id : check weather they are currently in a room or not`);
			// console.log(this.user_check);
			// console.log("gameCollection");
			// console.log(this.gameCollection);
			// console.log("clientAndUser");
			// console.log(this.clientAndUser);
		}



/*---------Game logic------------*/
		@SubscribeMessage('add1')
		async playgame(client: Socket, data: Number)
		{
			
			let flag=1;
			
			

			let noOfStarsHoldingbyAdminforThisClient = this.adminBlockStars[client.id]

			if(noOfStarsHoldingbyAdminforThisClient <= 0)
			{
			        //transfer other user star back to him	
		
					flag=0;
			
					let gameidOfUser = this.users[client.id]
			
					let currentGame = await this.passkey.findOne().where('gameid').equals(gameidOfUser).exec();
				 
					if(currentGame && currentGame.card2 !== "empty")
			
					{
			
						//other user card is given back to him
			
						let publickeyofthatUser = currentGame.player2address
		
						currentGame.card2 = "empty"
		
						await currentGame.save()
		
						let user2details =await this.user.findOne().where('publickey').equals(publickeyofthatUser).exec()
		
						let returnedTokenId = await user2details.usedCards.pop()
		
						await user2details.notUsedCards.push(returnedTokenId)

						//transfer user2 star from admin to user2 account

						user2details.stars += this.adminBlockStars[currentGame.client2id]

						this.adminBlockStars[currentGame.client2id]=0
		
						await user2details.save();
		
						let name2 = currentGame.user2
		
						this.wss.to(gameidOfUser).emit('card not played',`${name2} your card is not used as other user have not minimum no. of stars required to play `)
		
						client.emit('not valid no. of stars','your have zero stars you have minimum 1 star to play')
		
					}

					else{
						client.emit('card not played',`your card is not used as you have zero stars`)
		
						client.emit('not valid no. of stars','your have zero stars you have minimum 1 star to play')
	
					}

					let gameINDB = await this.passkey.findOne().where('gameid').equals(gameidOfUser).exec();

					if(gameINDB.playerWin.length !== 0)
					{
					let user1name = gameINDB.user1;

					let user2name = gameINDB.user2;

                    let user1=0,user2=0,tie=0;
		
									console.log(gameINDB.playerWin+"             "+gameINDB.playerWin.length)
		
									for(const player in gameINDB.playerWin)
		
									{
		
										console.log(gameINDB[player]+"#####")
		
										if(gameINDB.playerWin[player] === user1name)
		
										user1++;  
		
										else if(gameINDB.playerWin[player] === user2name)
		
										user2++;
		
										else
		
										tie++;
		
		
									}
		
									console.log(user1+"###"+user2+"###"+tie)
		
									const finalPlayerWon = (user1>user2)?user1name:((user2>user1)?user2name:"game is draw")
		
									this.wss.to(this.users[client.id]).emit('final',finalPlayerWon);							

								}
                      else{
						this.wss.to(this.users[client.id]).emit('game not played',"not a single game has been played to display the final result");
					  }
					  
					  await gameINDB.deleteOne()
	
					  await gameINDB.save()

					this.handleEndGame(client)
		
			}
			
		
			
			//store id of given card

			 let carddetail;

			 carddetail = await detailOfCard(data);
			
			 if(flag == 1)
			 {
				console.log(carddetail+"   "+carddetail[0]+"   "+carddetail[1]);
	
				let givenCardType
	
				(carddetail[0] === "1")?(givenCardType="ROCK"):(
										   (carddetail[0] === "2")?(givenCardType="PAPER"):(
																				(carddetail[0] === "3")?(givenCardType = "SCISSOR"):givenCardType="none"))
																				
				console.log(data)		
		
				let gameid=this.users[client.id]  
	
				if(givenCardType == CardStatus.PAPER || givenCardType == CardStatus.ROCK || givenCardType == CardStatus.SCISSOR)
	
				{
	
					if(this.check[client.id])
	
					{
					
						let gameexist= await this.passkey.findOne().where('gameid').equals(gameid).exec();
	
						let nameinUSERDB =await this.user.findOne().where('username').equals(this.clientidwithName[client.id]).exec()
		
						//find index of given card
				
						let indexofCard =(nameinUSERDB.notUsedCards.indexOf(data))
		
						console.log(indexofCard)
		
						// console.log(nameinUSERDB.notUsedCards.findIndex(givencardid))
	
						if(gameexist && indexofCard !== -1)
		
		
						{
		
								gameexist.card1 = givenCardType
	
								gameexist.user1=nameinUSERDB.username
	
								gameexist.player1address=nameinUSERDB.publickey
	
								gameexist.token1 = data
	
								nameinUSERDB.usedCards.push(data)
	
								nameinUSERDB.notUsedCards.splice(indexofCard,1,-1000)

								//nameinUSERDB.stars--
		
								await nameinUSERDB.save()
		
								await gameexist.save()
		
		
							}
			
							else if(indexofCard !== -1)
		
							{
		
								const cardDetail = new this.passkey({
		
								gameid:gameid,
		
								card1:givenCardType,
		
								user1:nameinUSERDB.username,
	
								player1address:nameinUSERDB.publickey,
	
								token1:data
							})
		  
							console.log( nameinUSERDB.notUsedCards[indexofCard])
	
							await nameinUSERDB.usedCards.push(data);
		
							nameinUSERDB.notUsedCards.splice(indexofCard,1,-1000)

							//nameinUSERDB.stars--
		
							await nameinUSERDB.save()
		
							await cardDetail.save()
		
						}
	
						gameexist = await this.passkey.findOne().where('gameid').equals(gameid).exec();
	
						if(gameexist.card1 && gameexist.card2 && gameexist.card1 !== "empty" && gameexist.card2 !== "empty")
		
						{
								
								let gameINDB= await this.passkey.findOne().where('gameid').equals(gameid).exec();
		
								const user1name = gameINDB.user1
		
								const user2name = gameINDB.user2
		
								const user1card = gameINDB.card1
		
								const user2card = gameINDB.card2
			  
								// const addressofplayer1 = gameINDB.player1address
	
								// const addressofplayer2 = gameINDB.player2address
	
								const gameResult=await  this.playservice.play(gameid);

								const userno1= await this.user.find().where('username').equals(user1name).exec();

								const userno2= await this.user.find().where('username').equals(user2name).exec();

								this.adminBlockStars[gameINDB.client1id]--;

								this.adminBlockStars[gameINDB.client2id]--;
		
								if(gameResult === "game is draw"){
		
								this.wss.to(gameid).emit('result',"game is draw")


								}
		
								else
		
								{
									
		
									this.wss.to(gameid).emit('result of round',gameResult+" WON ");
		
									this.wss.to(gameid).emit(`${user1name}+"cards"`,user1card);
		
									this.wss.to(gameid).emit(`${user2name}+"cards"`,user2card);
		
		
								}
		
								gameINDB= await this.passkey.findOne().where('gameid').equals(gameid).exec()
		
								if(gameINDB.playerWin.length === 3)
		
								{
		
									let user1=0,user2=0,tie=0;
		
									console.log(gameINDB.playerWin+"             "+gameINDB.playerWin.length)
		
									for(const player in gameINDB.playerWin)
		
									{
		
										console.log(gameINDB[player]+"#####")
		
										if(gameINDB.playerWin[player] === user1name)
		
										user1++;  
		
										else if(gameINDB.playerWin[player] === user2name)
		
										user2++;
		
										else
		
										tie++;
		
		
									}
		
									console.log(user1+"###"+user2+"###"+tie)
		
									const finalPlayerWon = (user1>user2)?user1name:((user2>user1)?user2name:"game is draw")
		
									this.wss.to(gameid).emit('final',finalPlayerWon);
	
	
									//delete this gameid data from database too
	
									await gameINDB.deleteOne()
	
									await gameINDB.save()
		
		
								
								}
			
							
							}
	
						}
	
					}
	  
		
			 }
	
	
			}
	
	  
		@SubscribeMessage('add2')
		async playgame1(client:Socket, data: Number)
		{

			let flag=1;
			
			let noOfStarsHoldingbyAdminforThisClient = this.adminBlockStars[client.id]

			if(noOfStarsHoldingbyAdminforThisClient <= 0)
			{
			        //transfer other user star back to him	
		
					flag=0;
			
					let gameidOfUser = this.users[client.id]
			
					let currentGame = await this.passkey.findOne().where('gameid').equals(gameidOfUser).exec();
				 
					if(currentGame && currentGame.card1 !== "empty")
			
					{
			
						//other user card is given back to him
			
						let publickeyofthatUser = currentGame.player1address
		
						currentGame.card1 = "empty"
		
						await currentGame.save()
		
						let user1details =await this.user.findOne().where('publickey').equals(publickeyofthatUser).exec()
		
						let returnedTokenId = await user1details.usedCards.pop()
		
						await user1details.notUsedCards.push(returnedTokenId)

						//transfer user2 star from admin to user2 account

						user1details.stars += this.adminBlockStars[currentGame.client1id]

						this.adminBlockStars[currentGame.client1id]=0
		
						await user1details.save();
		
						let name1 = currentGame.user1
		
						this.wss.to(gameidOfUser).emit('card not played',`${name1} your card is not used as other user have not minimum no. of stars required to play `)
		
						client.emit('not valid no. of stars','your have zero stars you have minimum 1 star to play')
		
					}
					else{
						client.emit('card not played',`your card is not used as you have zero stars`)
		
						client.emit('not valid no. of stars','your have zero stars you have minimum 1 star to play')
	
					}

					let gameINDB = await this.passkey.findOne().where('gameid').equals(gameidOfUser).exec();

					if(gameINDB.playerWin.length !== 0)
					{

					let user1name = gameINDB.user1;

					let user2name = gameINDB.user2;

                    let user1=0,user2=0,tie=0;
		
									console.log(gameINDB.playerWin+"             "+gameINDB.playerWin.length)
		
									for(const player in gameINDB.playerWin)
		
									{
		
										console.log(gameINDB[player]+"#####")
		
										if(gameINDB.playerWin[player] === user1name)
		
										user1++;  
		
										else if(gameINDB.playerWin[player] === user2name)
		
										user2++;
		
										else
		
										tie++;
		
		
									}
		
									console.log(user1+"###"+user2+"###"+tie)
		
									const finalPlayerWon = (user1>user2)?user1name:((user2>user1)?user2name:"game is draw")
		
									this.wss.to(this.users[client.id]).emit('final',finalPlayerWon);
								}
									
								
								else{
								
									this.wss.to(this.users[client.id]).emit('game not played',"not a single game has been played to display the final result");
								
								}
				
		
	
									await gameINDB.deleteOne()
	
									await gameINDB.save()
								


					this.handleEndGame(client)
		
			}
		
		
			
			 //store id of given card
			 let carddetail;
		
	         carddetail = await detailOfCard(data);
			
			if(flag == 1)
			{
		
				console.log(carddetail+"   "+carddetail[0]+"   "+carddetail[1]);
	
				let givenCardType
	
				(carddetail[0] === "1")?(givenCardType="ROCK"):(
										   (carddetail[0] === "2")?(givenCardType="PAPER"):(
																				(carddetail[0] === "3")?(givenCardType = "SCISSOR"):givenCardType="none"))
																				
				console.log(data)		
		
				let gameid=this.users[client.id]  
	
				if(givenCardType == CardStatus.PAPER || givenCardType == CardStatus.ROCK || givenCardType == CardStatus.SCISSOR)
	
				{
	
					if(this.check[client.id])
	
					{
					
						let gameexist= await this.passkey.findOne().where('gameid').equals(gameid).exec();
	
						let nameinUSERDB =await this.user.findOne().where('username').equals(this.clientidwithName[client.id]).exec()
		
						//find index of given card
				
						let indexofCard =(nameinUSERDB.notUsedCards.indexOf(data))
		
						console.log(indexofCard)
		
						// console.log(nameinUSERDB.notUsedCards.findIndex(givencardid))
	
						if(gameexist && indexofCard !== -1)
		
		
						{
		
								gameexist.card2 = givenCardType
	
								gameexist.user2=nameinUSERDB.username
	
								gameexist.player2address=nameinUSERDB.publickey
	
								gameexist.token2 = data
	
								nameinUSERDB.usedCards.push(data)
	
								nameinUSERDB.notUsedCards.splice(indexofCard,1,-1000)

								//nameinUSERDB.stars--
		
								await nameinUSERDB.save()
		
								await gameexist.save()
		
		
							}
			
							else if(indexofCard !== -1)
		
							{
		
								const cardDetail = new this.passkey({
		
								gameid:gameid,
		
								card2:givenCardType,
		
								user2:nameinUSERDB.username,
	
								player2address:nameinUSERDB.publickey,
	
								token2:data
							})
		  
							console.log( nameinUSERDB.notUsedCards[indexofCard])
	
							await nameinUSERDB.usedCards.push(data);
		
							nameinUSERDB.notUsedCards.splice(indexofCard,1,-1000)

							//nameinUSERDB.stars--
		
							await nameinUSERDB.save()
		
							await cardDetail.save()
		
						}
	
						gameexist = await this.passkey.findOne().where('gameid').equals(gameid).exec();
	
						if(gameexist.card1 && gameexist.card2 && gameexist.card1 !== "empty" && gameexist.card2 !== "empty")
		
						{
								let gameINDB= await this.passkey.findOne().where('gameid').equals(gameid).exec();
		
								const user1name = gameINDB.user1
		
								const user2name = gameINDB.user2
		
								const user1card = gameINDB.card1
		
								const user2card = gameINDB.card2
			  
								// const addressofplayer1 = gameINDB.player1address
	
								// const addressofplayer2 = gameINDB.player2address
	
								const gameResult=await  this.playservice.play(gameid);

								// const userno1= await this.user.find().where('username').equals(user1name).exec();

								// const userno2= await this.user.find().where('username').equals(user2name).exec();

								this.adminBlockStars[gameINDB.client1id]--;

								this.adminBlockStars[gameINDB.client2id]--;
		
								if(gameResult === "game is draw")
		
								this.wss.to(gameid).emit('result',"game is draw")
		
								else
		
								{
		
									this.wss.to(gameid).emit('result of round',gameResult+" WON ");
		
									this.wss.to(gameid).emit(`${user1name}+"cards"`,user1card);
		
									this.wss.to(gameid).emit(`${user2name}+"cards"`,user2card);
		
		
								}
		
								gameINDB= await this.passkey.findOne().where('gameid').equals(gameid).exec()
		
								if(gameINDB.playerWin.length === 3)
		
								{
		
									let user1=0,user2=0,tie=0;
		
									console.log(gameINDB.playerWin+"             "+gameINDB.playerWin.length)
		
									for(const player in gameINDB.playerWin)
		
									{
		
										console.log(gameINDB[player]+"#####")
		
										if(gameINDB.playerWin[player] === user1name)
		
										user1++;  
		
										else if(gameINDB.playerWin[player] === user2name)
		
										user2++;
		
										else
		
										tie++;
		
		
									}
		
									console.log(user1+"###"+user2+"###"+tie)
		
									const finalPlayerWon = (user1>user2)?user1name:((user2>user1)?user2name:"game is draw")
		
									this.wss.to(gameid).emit('final',finalPlayerWon);
		
	
									await gameINDB.deleteOne()
	
									await gameINDB.save()
								
								}
			
							
							}
	
						}
	
					}
	  
		
				}
			
	
		}

	}


	// @SubscribeMessage('list')
	// handlelist(client: Socket, data: string):void {

	// 	if(this.check[client.id]) client.emit('list',this.general.users)

	// 	else

	// 	{

	// 		client.emit('warning','unauthorised access')

	// 	}

	// }




	// @SubscribeMessage('userconnected')
	// currconnected(client: Socket, data: string):void {

	// 	if(this.check[client.id]) client.emit('list',this.currConnected)

	// 	else

	// 	{

	// 		client.emit('warning','unauthorised access')

	// 	}

	// }





// @SubscribeMessage('showGame')
  
  // showGame(client:Socket){
  
  // if(this.check[client.id])
  
  //   {
  
  //    console.log(this.gameCollection)
  
  //    client.emit('gamecollection',this.gameCollection)
  
  //   }
  
  // }


  
  // @SubscribeMessage('joinGame')
  // joinGame(client:Socket,data:string){
  //    if(this.gameCollection[data] && this.check[client.id])
  //    {
  //      client.join(data)
  //      this.users[client.id]=data
  //      this.gameCollection[data].userarray.push(this.clientAndUser[client.id])
  //      this.check[client.id]=true
  //    }
  // }

