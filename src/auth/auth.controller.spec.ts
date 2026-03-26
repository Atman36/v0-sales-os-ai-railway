import { AuthController } from './auth.controller'

describe('AuthController', () => {
  const authService = {
    login: jest.fn(),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
    logout: jest.fn(),
  } as any

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('accepts login as the explicit credential identifier', async () => {
    const controller = new AuthController(authService)
    authService.login.mockResolvedValue({ accessToken: 'token' })

    await controller.login({
      login: 'admin@salesos.ai',
      password: 'admin123',
    })

    expect(authService.login).toHaveBeenCalledWith('admin@salesos.ai', 'admin123')
  })

  it('keeps backward compatibility with email payloads', async () => {
    const controller = new AuthController(authService)
    authService.login.mockResolvedValue({ accessToken: 'token' })

    await controller.login({
      email: 'admin@salesos.ai',
      password: 'admin123',
    })

    expect(authService.login).toHaveBeenCalledWith('admin@salesos.ai', 'admin123')
  })
})
