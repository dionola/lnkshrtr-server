from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..services import links as links_controller
from ..lib.database import get_db
from ..middleware.auth import get_current_user, get_optional_user
from ..models import User
from ..schemas.links import CreateLinkBody, LinkResponse, UpdateLinkBody, VerifyPasswordBody

router = APIRouter(prefix='/links', tags=['links'])


@router.get('/code/{short_code}', response_model=LinkResponse)
def get_link_by_code(short_code: str, db: Session = Depends(get_db)):
    return links_controller.get_by_code(short_code, db)


@router.post('/code/{short_code}/click')
def click_link(short_code: str, db: Session = Depends(get_db)):
    return links_controller.record_click(short_code, db)


@router.post('/code/{short_code}')
def verify_password(short_code: str, body: VerifyPasswordBody, db: Session = Depends(get_db)):
    return links_controller.verify_password(short_code, body, db)


@router.post('', status_code=201, response_model=LinkResponse)
def create_link(body: CreateLinkBody, db: Session = Depends(get_db),
                current_user: User | None = Depends(get_optional_user)):
    return links_controller.create_link(body, db, current_user)


@router.get('', response_model=list[LinkResponse])
def list_links(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return links_controller.list_links(db, current_user)


@router.put('/{link_id}', response_model=LinkResponse)
def update_link(link_id: str, body: UpdateLinkBody, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    return links_controller.update_link(link_id, body, db, current_user)


@router.delete('/{link_id}', status_code=204)
def delete_link(link_id: str, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    links_controller.delete_link(link_id, db, current_user)
