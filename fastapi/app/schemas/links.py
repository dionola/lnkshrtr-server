from typing import Optional

from pydantic import BaseModel, field_validator, model_validator


class CreateLinkBody(BaseModel):
    url: str
    customCode: Optional[str] = None
    isPublic: bool = True
    isPasswordProtected: bool = False
    password: Optional[str] = None
    type: str = 'link'

    @field_validator('url')
    @classmethod
    def url_must_be_http(cls, v: str) -> str:
        from urllib.parse import urlparse
        if not (v.startswith('http://') or v.startswith('https://')):
            raise ValueError('URL must be a valid http or https address')
        if not urlparse(v).netloc:
            raise ValueError('URL must be a valid http or https address')
        return v

    @field_validator('type')
    @classmethod
    def type_must_be_valid(cls, v: str) -> str:
        if v != 'link':
            raise ValueError('type must be link')
        return v

    @model_validator(mode='after')
    def validate_password_fields(self) -> 'CreateLinkBody':
        if self.isPasswordProtected:
            if not self.password:
                raise ValueError('password is required when isPasswordProtected is true')
            if len(self.password) < 6:
                raise ValueError('password must be at least 6 characters')
        return self


class UpdateLinkBody(BaseModel):
    title: Optional[str] = None
    isPublic: Optional[bool] = None
    isActive: Optional[bool] = None
    isPasswordProtected: Optional[bool] = None
    password: Optional[str] = None

    @model_validator(mode='after')
    def validate_password_fields(self) -> 'UpdateLinkBody':
        if self.isPasswordProtected is True and self.password is not None:
            if len(self.password) < 6:
                raise ValueError('password must be at least 6 characters')
        return self


class VerifyPasswordBody(BaseModel):
    password: str

    @field_validator('password')
    @classmethod
    def password_required(cls, v: str) -> str:
        if not v:
            raise ValueError('Password is required')
        return v


class LinkResponse(BaseModel):
    id: str
    shortCode: str
    originalUrl: str
    title: str
    visits: int
    createdAt: str
    isPublic: bool
    isActive: bool
    isPasswordProtected: bool
    type: str
    userId: Optional[str]
    updatedAt: Optional[str]
