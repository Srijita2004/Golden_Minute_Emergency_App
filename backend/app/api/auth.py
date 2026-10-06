from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.schemas import (
    UserRegister, UserLogin, UserOut, TokenResponse, 
    RefreshTokenRequest, ForgotPasswordRequest, ResetPasswordRequest, HospitalRegister
)
from app.services.auth_service import AuthService
from app.api.deps import get_current_user
from app.models.all_models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=TokenResponse)
def register(req: UserRegister, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    user = AuthService.register_user(db, req, ip_address=ip)
    # Automatically generate tokens for newly registered user
    login_req = UserLogin(email=req.email, password=req.password)
    user, access_token, refresh_token = AuthService.authenticate_user(db, login_req, ip_address=ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user)
    )

@router.post("/register-hospital", response_model=TokenResponse)
def register_hospital(req: HospitalRegister, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    user = AuthService.register_hospital(db, req, ip_address=ip)
    # Automatically generate tokens for newly registered hospital admin
    login_req = UserLogin(email=req.email, password=req.password)
    user, access_token, refresh_token = AuthService.authenticate_user(db, login_req, ip_address=ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user)
    )

@router.post("/login", response_model=TokenResponse)
def login(req: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else None
    user, access_token, refresh_token = AuthService.authenticate_user(db, req, ip_address=ip)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user)
    )

@router.post("/refresh")
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    new_token = AuthService.refresh_access_token(db, req.refresh_token)
    return {"access_token": new_token, "token_type": "bearer"}

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {"ok": True, "message": "Successfully logged out."}

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    token = AuthService.request_password_reset(db, req.email)
    return {"ok": True, "message": "Password reset token generated.", "reset_token": token}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    AuthService.reset_password(db, req.token, req.new_password)
    return {"ok": True, "message": "Password reset successfully. Please login with your new password."}

@router.get("/me", response_model=UserOut)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
