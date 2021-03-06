import { Link } from "react-router-dom";
import React from "react";

export const SandboxButton = (props) => (
    <div className="col btn-container">
        <Link to="/sandbox" className="btn btn-primary">
            Sandbox Mode
        </Link>
    </div>
)

export const HelpButton = (props) => (
    <div className="col btn-container">
      <Link to="/help" className="btn btn-primary">
        How to Play
      </Link>
    </div>
)

export const HomeButton = (props) => (
  <div className="col btn-container">
    <Link to="/" className="btn btn-primary">
      Back to Home
    </Link>
  </div>
)

export const LobbyButton = (props) => (
  <div className="col btn-container">
    <Link to="/lobby" className="btn btn-primary">
      Game Lobby
    </Link>
  </div>
)

export const GenerateMapButton = (props) => (
  <div className="col btn-container">
    <Link to="/generate" className="btn btn-primary">
      Generate Map
    </Link>
  </div>
)
