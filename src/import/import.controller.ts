import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentAuthUser, requireRopAccess } from '../auth/access-control'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

type UploadedExcelFile = {
  originalname: string
  size: number
  mimetype: string
}

@Controller('import')
export class ImportController {
  @UseGuards(JwtAuthGuard)
  @Post('excel')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async importExcel(@UploadedFile() file: UploadedExcelFile | undefined, @CurrentUser() user: CurrentAuthUser) {
    requireRopAccess(user)

    if (!file) {
      throw new BadRequestException('file is required (multipart/form-data; field name: file)')
    }

    return {
      status: 'accepted',
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      note: 'Upload accepted. Excel parsing/import pipeline is not implemented yet.',
    }
  }
}
