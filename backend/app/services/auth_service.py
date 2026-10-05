import datetime
import uuid
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.all_models import User, AuditLog
from app.schemas.schemas import UserRegister, UserLogin
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, decode_token

class AuthService:

    @staticmethod
    def generate_next_user_id(db: Session) -> str:
        """Generates sequence User IDs: USER-001, USER-002, etc."""
        count = db.query(User).count()
        return f"USER-{(count + 1):03d}"

    @staticmethod
    def register_user(db: Session, req: UserRegister, ip_address: Optional[str] = None) -> User:
        # Check duplicate email
        existing = db.query(User).filter(User.email == req.email.lower()).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists."
            )

        user_id = AuthService.generate_next_user_id(db)
        hashed_pw = get_password_hash(req.password)

        new_user = User(
            user_id=user_id,
            name=req.name.strip(),
            email=req.email.lower().strip(),
            hashed_password=hashed_pw,
            role="USER",
            status="ACTIVE"
        )
        db.add(new_user)

        # Audit log
        audit = AuditLog(
            actor_user_id=user_id,
            action="USER_REGISTERED",
            resource_type="USER",
            resource_id=user_id,
            details=f"User {req.name} registered with email {req.email}",
            ip_address=ip_address
        )
        db.add(audit)
        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate_user(db: Session, req: UserLogin, ip_address: Optional[str] = None) -> Tuple[User, str, str]:
        user = db.query(User).filter(User.email == req.email.lower().strip()).first()
        if not user or not verify_password(req.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password."
            )

        if user.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is suspended. Please contact administrator."
            )

        token_data = {"sub": user.user_id, "email": user.email, "role": user.role}
        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token(token_data)

        # Audit log
        audit = AuditLog(
            actor_user_id=user.user_id,
            action="USER_LOGIN",
            resource_type="USER",
            resource_id=user.user_id,
            details=f"Successful login for {user.user_id}",
            ip_address=ip_address
        )
        db.add(audit)
        db.commit()

        return user, access_token, refresh_token

    @staticmethod
    def refresh_access_token(db: Session, refresh_token: str) -> str:
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

        user_id = payload.get("sub")
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user or user.status != "ACTIVE":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

        token_data = {"sub": user.user_id, "email": user.email, "role": user.role}
        return create_access_token(token_data)

    @staticmethod
    def request_password_reset(db: Session, email: str) -> str:
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if not user:
            # Prevent email enumeration by returning success message
            return "If your email is registered, a reset token has been issued."
        
        token = str(uuid.uuid4())
        user.reset_token = token
        user.reset_token_expires = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        db.commit()
        return token

    @staticmethod
    def reset_password(db: Session, token: str, new_password: str) -> bool:
        user = db.query(User).filter(
            User.reset_token == token,
            User.reset_token_expires > datetime.datetime.utcnow()
        ).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

        user.hashed_password = get_password_hash(new_password)
        user.reset_token = None
        user.reset_token_expires = None
        db.commit()
        return True
