from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..services import auth as auth_controller
from ..lib.database import get_db
from ..middleware.auth import get_current_user
from ..models import User
from ..schemas.auth import AuthResponse, LoginBody, SignupBody, UserResponse

router = APIRouter(prefix='/auth', tags=['auth'])


@router.post('/signup', status_code=201, response_model=AuthResponse)
def signup(body: SignupBody, db: Session = Depends(get_db)):
    return auth_controller.signup(body, db)


@router.post('/login', response_model=AuthResponse)
def login(body: LoginBody, db: Session = Depends(get_db)):
    return auth_controller.login(body, db)


@router.get('/me', response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return auth_controller.me(current_user)


@router.get('/google')
def google_oauth_init():
    return auth_controller.google_init()


@router.get('/google/callback')
def google_oauth_callback(request: Request, db: Session = Depends(get_db)):
    code = request.query_params.get('code')
    return auth_controller.google_callback(code, db)
