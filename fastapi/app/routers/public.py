from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..services import public as public_controller
from ..lib.database import get_db
from ..schemas.auth import UserResponse
from ..schemas.links import LinkResponse

router = APIRouter(prefix='/public', tags=['public'])


@router.get('/{username}', response_model=UserResponse)
def public_profile(username: str, db: Session = Depends(get_db)):
    return public_controller.public_profile(username, db)


@router.get('/{username}/links', response_model=list[LinkResponse])
def public_links(username: str, db: Session = Depends(get_db)):
    return public_controller.public_links(username, db)
