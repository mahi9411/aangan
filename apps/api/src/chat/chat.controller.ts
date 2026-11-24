import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsString, MaxLength } from 'class-validator'
import { AuthUser, CurrentUser } from '../common/http'
import { ChatService } from './chat.service'

class MessageDto {
  @IsString() @MaxLength(1000) body: string
}

@ApiTags('chat')
@ApiBearerAuth()
@Controller('bookings/:id/messages')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.list(id, user)
  }

  @Post()
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: MessageDto) {
    return this.chat.send(id, user, body.body)
  }
}
