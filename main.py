import io
import json
import random
import os
import datetime
import pytz
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from PIL import Image

from parser import parse

# Configuration de la base de données
DATABASE_URL = "sqlite:///./crosswords.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Modèle de la base de données
class Crossword(Base):
    __tablename__ = "crosswords"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    coordinates = Column(Text) # Remplacer matrix par coordinates
    user_letters = Column(Text, default="{}")
    image_path = Column(String, nullable=True)
    square_height = Column(Integer, nullable=True)

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Créer le dossier d'uploads s'il n'existe pas
UPLOADS_DIR = "uploads"
os.makedirs(UPLOADS_DIR, exist_ok=True)

# Monter les dossiers statiques
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# --- Fonctions utilitaires ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def parse_crossword_image(image_path: str) -> tuple:
    """
    Algorithme qui utilise le parser pour retourner les coordonnées
    et la hauteur moyenne des cases.
    """
    try:
        coords, square_pixel_height = parse(image_path)
        return coords, square_pixel_height
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur de traitement d'image: {e}")


# --- Endpoints de l'API ---

@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("static/index.html") as f:
        return HTMLResponse(content=f.read(), status_code=200)

@app.post("/upload-crossword/")
async def upload_crossword(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()

    # Générer un nom de fichier basé sur la date et l'heure (fuseau horaire de Paris)
    paris_tz = pytz.timezone("Europe/Paris")
    timestamp = datetime.datetime.now(paris_tz).strftime("%Y%m%d-%H%M")
    file_extension = os.path.splitext(file.filename)[1]
    new_filename = f"{timestamp}{file_extension}"
    
    file_path = os.path.join(UPLOADS_DIR, new_filename)
    with open(file_path, "wb") as f:
        f.write(contents)
    
    try:
        coordinates, square_height = parse_crossword_image(file_path)
    except HTTPException as e:
        # Supprimer l'image si le parsing échoue
        os.remove(file_path)
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})

    new_crossword = Crossword(
        name=new_filename,
        coordinates=json.dumps(coordinates),
        image_path=file_path,
        square_height=square_height
    )
    db.add(new_crossword)
    db.commit()
    db.refresh(new_crossword)
    
    return JSONResponse(content={
        "id": new_crossword.id,
        "name": new_crossword.name,
        "image_path": new_crossword.image_path,
        "coordinates": coordinates,
        "user_letters": {},
        "square_height": square_height
    })

@app.get("/crosswords/")
async def get_crosswords_list(db: Session = Depends(get_db)):
    crosswords = db.query(Crossword).all()
    
    result = []
    for cw in crosswords:
        result.append({"id": cw.id, "name": cw.name})
        
    return JSONResponse(content=result)

@app.get("/crosswords/{crossword_id}/")
async def get_crossword_details(crossword_id: int, db: Session = Depends(get_db)):
    crossword = db.query(Crossword).filter(Crossword.id == crossword_id).first()
    
    if not crossword:
        raise HTTPException(status_code=404, detail="Mots croisés non trouvé")
        
    return JSONResponse(content={
        "id": crossword.id,
        "name": crossword.name,
        "image_path": crossword.image_path,
        "coordinates": json.loads(crossword.coordinates),
        "user_letters": json.loads(crossword.user_letters),
        "square_height": crossword.square_height
    })

@app.post("/update-cell/")
async def update_cell(data: dict, db: Session = Depends(get_db)):
    crossword_id = data.get("crossword_id")
    cell_index = data.get("cell_index")
    letter = data.get("letter", "")
    
    crossword = db.query(Crossword).filter(Crossword.id == crossword_id).first()
    
    if not crossword:
        raise HTTPException(status_code=404, detail="Mots croisés non trouvé")
        
    user_letters = json.loads(crossword.user_letters)
    key = str(cell_index)
    
    if letter:
        user_letters[key] = letter
    elif key in user_letters:
        del user_letters[key]
    
    crossword.user_letters = json.dumps(user_letters)
    db.commit()
    
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
